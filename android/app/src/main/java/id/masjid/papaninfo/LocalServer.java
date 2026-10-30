package id.masjid.papaninfo;

import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.InetSocketAddress;
import java.net.NetworkInterface;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.Charset;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Server web kecil di dalam box.
 * - Menyajikan halaman layar & pengaturan dari folder aset aplikasi.
 * - Menyimpan pengaturan (config.json) dan PIN di penyimpanan internal box.
 * - Dengan ini pengurus bisa mengubah isi papan info dari HP yang satu WiFi.
 * Sengaja tidak memakai pustaka Android agar mudah diuji di komputer biasa.
 */
public class LocalServer {

    /** Sumber file halaman (di Android: AssetManager). */
    public interface Assets {
        InputStream open(String path) throws IOException;
    }

    /** Keterangan tambahan dari box untuk /api/info (di Android: PowerCheck). */
    public interface Status {
        String json();
    }

    private static final Charset UTF8 = Charset.forName("UTF-8");
    private static final int[] PORTS = {8080, 8081, 8082, 8083, 8084, 8085, 8086, 8087, 8088, 8089, 8888};
    private static final int MAX_BODY = 4 * 1024 * 1024;
    private static final String DEFAULT_PIN = "1234";

    private final Assets assets;
    private final File configFile, pinFile, photoFile, portFile;
    private final Object lock = new Object();
    private final ExecutorService pool = Executors.newFixedThreadPool(4);
    private final String version;
    private ServerSocket serverSocket;
    private volatile int port = -1;
    private volatile Status status;

    // jam yang disamakan dari HP, dijangkarkan ke jam monotonik box
    // (tetap benar walau jam sistem box salah; hilang bila box dimatikan)
    private volatile long clockAnchorMs = 0, clockAnchorNano = 0;

    // pengaman tebak-tebakan PIN
    private int wrongCount = 0;
    private long lockedUntil = 0;

    public LocalServer(Assets assets, File dataDir, String version) {
        this.assets = assets;
        this.configFile = new File(dataDir, "config.json");
        this.pinFile = new File(dataDir, "pin.txt");
        this.portFile = new File(dataDir, "port.txt");
        this.photoFile = new File(dataDir, "foto-masjid.jpg");
        this.version = version;
    }

    public void setStatus(Status s) { status = s; }

    public synchronized int start() throws IOException {
        if (port > 0) return port;
        // urutan coba: port yang terakhir dipakai (agar alamat di HP tidak berubah-ubah),
        // lalu 8080-8089, 8888, dan terakhir port bebas mana saja pilihan sistem (0)
        List<Integer> tries = new ArrayList<Integer>();
        int saved = readSavedPort();
        if (saved > 0) tries.add(saved);
        for (int p : PORTS) if (!tries.contains(p)) tries.add(p);
        tries.add(0);
        IOException last = null;
        for (int p : tries) {
            try {
                ServerSocket s = new ServerSocket();
                s.setReuseAddress(true);
                s.bind(new InetSocketAddress(p));
                serverSocket = s;
                port = s.getLocalPort();
                break;
            } catch (IOException e) {
                last = e;
            }
        }
        if (port < 0) throw last != null ? last : new IOException("Tidak ada port yang bebas");
        if (port != saved) savePort(port);
        Thread t = new Thread(new Runnable() {
            @Override public void run() { acceptLoop(); }
        }, "papan-info-server");
        t.setDaemon(true);
        t.start();
        return port;
    }

    private int readSavedPort() {
        try {
            String s = new String(readFile(portFile), UTF8).trim();
            int p = Integer.parseInt(s);
            return p > 0 && p < 65536 ? p : -1;
        } catch (Exception e) {
            return -1;
        }
    }

    private void savePort(int p) {
        try { writeAtomic(portFile, String.valueOf(p).getBytes(UTF8)); } catch (IOException ignored) { }
    }

    public int getPort() { return port; }

    public String localUrl(String path) { return "http://127.0.0.1:" + port + path; }

    private void acceptLoop() {
        while (!serverSocket.isClosed()) {
            try {
                final Socket c = serverSocket.accept();
                pool.execute(new Runnable() {
                    @Override public void run() { handle(c); }
                });
            } catch (IOException e) {
                if (serverSocket.isClosed()) return;
            }
        }
    }

    // ------------------------------------------------------------------ HTTP

    private static class Request {
        String method, path;
        Map<String, String> headers = new HashMap<String, String>();
        byte[] body = new byte[0];
        boolean local;
    }

    private void handle(Socket c) {
        try {
            c.setSoTimeout(15000);
            InputStream in = new BufferedInputStream(c.getInputStream());
            OutputStream out = c.getOutputStream();
            Request r = read(in);
            if (r == null) { c.close(); return; }
            r.local = c.getInetAddress() != null && c.getInetAddress().isLoopbackAddress();
            route(r, out);
            out.flush();
        } catch (Exception ignored) {
        } finally {
            try { c.close(); } catch (IOException ignored) { }
        }
    }

    private Request read(InputStream in) throws IOException {
        ByteArrayOutputStream head = new ByteArrayOutputStream();
        int b, state = 0;
        while ((b = in.read()) != -1) {
            head.write(b);
            if (head.size() > 16384) return null;
            state = (b == '\r' && (state == 0 || state == 2)) ? state + 1 : (b == '\n' && (state == 1 || state == 3)) ? state + 1 : 0;
            if (state == 4) break;
        }
        if (state != 4) return null;
        String[] lines = new String(head.toByteArray(), UTF8).split("\r\n");
        String[] first = lines[0].split(" ");
        if (first.length < 2) return null;
        Request r = new Request();
        r.method = first[0].toUpperCase(Locale.ROOT);
        String p = first[1];
        int q = p.indexOf('?');
        r.path = q >= 0 ? p.substring(0, q) : p;
        for (int i = 1; i < lines.length; i++) {
            int k = lines[i].indexOf(':');
            if (k > 0) r.headers.put(lines[i].substring(0, k).trim().toLowerCase(Locale.ROOT), lines[i].substring(k + 1).trim());
        }
        String cl = r.headers.get("content-length");
        if (cl != null) {
            int len;
            try { len = Integer.parseInt(cl); } catch (NumberFormatException e) { return null; }
            if (len < 0 || len > MAX_BODY) return null;
            byte[] body = new byte[len];
            int off = 0;
            while (off < len) {
                int n = in.read(body, off, len - off);
                if (n < 0) break;
                off += n;
            }
            r.body = body;
        }
        return r;
    }

    private void route(Request r, OutputStream out) throws IOException {
        String path = r.path;
        if (path.startsWith("/api/")) {
            if (path.equals("/api/info") && r.method.equals("GET")) {
                String ip = findIp();
                String json = "{\"app\":\"masjid-tv\",\"version\":\"" + esc(version) + "\",\"port\":" + port +
                        ",\"ip\":" + (ip == null ? "null" : "\"" + ip + "\"") +
                        ",\"defaultPin\":" + (!pinFile.exists()) + ",\"onBox\":" + r.local;
                String extra = null;
                try { if (status != null) extra = status.json(); } catch (Exception ignored) { }
                json += ",\"power\":" + (extra == null ? "null" : extra) + "}";
                send(out, 200, "application/json", json.getBytes(UTF8));
                return;
            }
            if (path.equals("/api/config") && r.method.equals("GET")) {
                byte[] data;
                synchronized (lock) { data = configFile.exists() ? readFile(configFile) : new byte[0]; }
                send(out, 200, "application/json", data);
                return;
            }
            if (path.equals("/api/check") && r.method.equals("POST")) {
                boolean ok = checkPin(r);
                send(out, ok ? 200 : 403, "application/json", (ok ? "{\"ok\":true}" : "{\"ok\":false}").getBytes(UTF8));
                return;
            }
            if (path.equals("/api/config") && r.method.equals("POST")) {
                if (!checkPin(r)) { send(out, 403, "application/json", "{\"error\":\"pin\"}".getBytes(UTF8)); return; }
                String s = new String(r.body, UTF8).trim();
                if (!s.startsWith("{") || !s.endsWith("}")) { send(out, 400, "application/json", "{\"error\":\"json\"}".getBytes(UTF8)); return; }
                synchronized (lock) { writeAtomic(configFile, s.getBytes(UTF8)); }
                send(out, 200, "application/json", "{\"ok\":true}".getBytes(UTF8));
                return;
            }
            if (path.equals("/api/pin") && r.method.equals("POST")) {
                if (!checkPin(r)) { send(out, 403, "application/json", "{\"error\":\"pin\"}".getBytes(UTF8)); return; }
                String np = new String(r.body, UTF8).trim();
                if (!np.matches("\\d{4,8}")) { send(out, 400, "application/json", "{\"error\":\"format\"}".getBytes(UTF8)); return; }
                synchronized (lock) { writeAtomic(pinFile, np.getBytes(UTF8)); }
                send(out, 200, "application/json", "{\"ok\":true}".getBytes(UTF8));
                return;
            }
            if (path.equals("/api/pin-reset") && r.method.equals("POST")) {
                // lupa PIN: hanya boleh dari layar TV itu sendiri (remote di tangan),
                // tidak bisa dari HP atau perangkat lain di WiFi
                if (!r.local) { send(out, 403, "application/json", "{\"error\":\"local\"}".getBytes(UTF8)); return; }
                String np = new String(r.body, UTF8).trim();
                if (!np.matches("\\d{4,8}")) { send(out, 400, "application/json", "{\"error\":\"format\"}".getBytes(UTF8)); return; }
                synchronized (lock) { writeAtomic(pinFile, np.getBytes(UTF8)); wrongCount = 0; lockedUntil = 0; }
                send(out, 200, "application/json", "{\"ok\":true}".getBytes(UTF8));
                return;
            }
            if (path.equals("/api/clock") && r.method.equals("GET")) {
                long box = System.currentTimeMillis();
                String now = clockAnchorNano == 0 ? "null"
                        : String.valueOf(clockAnchorMs + (System.nanoTime() - clockAnchorNano) / 1000000L);
                send(out, 200, "application/json", ("{\"synced\":" + (clockAnchorNano != 0) + ",\"now\":" + now + ",\"box\":" + box + "}").getBytes(UTF8));
                return;
            }
            if (path.equals("/api/clock") && r.method.equals("POST")) {
                if (!checkPin(r)) { send(out, 403, "application/json", "{\"error\":\"pin\"}".getBytes(UTF8)); return; }
                long t;
                try { t = Long.parseLong(new String(r.body, UTF8).trim()); } catch (NumberFormatException e) { t = -1; }
                if (t < 1700000000000L) { send(out, 400, "application/json", "{\"error\":\"time\"}".getBytes(UTF8)); return; }
                clockAnchorNano = System.nanoTime();
                clockAnchorMs = t;
                send(out, 200, "application/json", "{\"ok\":true}".getBytes(UTF8));
                return;
            }
            if (path.equals("/api/photo") && r.method.equals("POST")) {
                if (!checkPin(r)) { send(out, 403, "application/json", "{\"error\":\"pin\"}".getBytes(UTF8)); return; }
                byte[] b = r.body;
                boolean jpeg = b.length > 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8;
                if (!jpeg) { send(out, 400, "application/json", "{\"error\":\"jpeg\"}".getBytes(UTF8)); return; }
                synchronized (lock) { writeAtomic(photoFile, b); }
                send(out, 200, "application/json", "{\"ok\":true}".getBytes(UTF8));
                return;
            }
            if (path.equals("/api/photo-delete") && r.method.equals("POST")) {
                if (!checkPin(r)) { send(out, 403, "application/json", "{\"error\":\"pin\"}".getBytes(UTF8)); return; }
                synchronized (lock) { if (photoFile.exists()) photoFile.delete(); }
                send(out, 200, "application/json", "{\"ok\":true}".getBytes(UTF8));
                return;
            }
            send(out, 404, "application/json", "{\"error\":\"not found\"}".getBytes(UTF8));
            return;
        }
        if (path.equals("/foto-masjid.jpg") && (r.method.equals("GET") || r.method.equals("HEAD"))) {
            byte[] data = null;
            synchronized (lock) { if (photoFile.exists()) data = readFile(photoFile); }
            if (data == null) send(out, 404, "text/plain; charset=utf-8", "Belum ada foto".getBytes(UTF8));
            else send(out, 200, "image/jpeg", r.method.equals("HEAD") ? new byte[0] : data);
            return;
        }

        if (!r.method.equals("GET") && !r.method.equals("HEAD")) { send(out, 405, "text/plain", "Method not allowed".getBytes(UTF8)); return; }
        // HP yang membuka alamat box langsung diarahkan ke halaman pengaturan
        if (path.equals("/")) path = r.local ? "/index.html" : "/admin.html";
        if (path.contains("..") || path.contains("\\")) { send(out, 400, "text/plain", "Bad path".getBytes(UTF8)); return; }
        InputStream in = null;
        try {
            in = assets.open(path.substring(1));
            byte[] data = readAll(in);
            send(out, 200, mime(path), r.method.equals("HEAD") ? new byte[0] : data);
        } catch (IOException e) {
            send(out, 404, "text/plain; charset=utf-8", "Halaman tidak ditemukan".getBytes(UTF8));
        } finally {
            if (in != null) try { in.close(); } catch (IOException ignored) { }
        }
    }

    private boolean checkPin(Request r) {
        String given = r.headers.get("x-pin");
        boolean ok;
        synchronized (lock) {
            long now = System.currentTimeMillis();
            if (now < lockedUntil) return false;
            String pin = DEFAULT_PIN;
            if (pinFile.exists()) {
                try { pin = new String(readFile(pinFile), UTF8).trim(); } catch (IOException ignored) { }
            }
            ok = given != null && given.equals(pin);
            if (ok) wrongCount = 0;
            else if (++wrongCount >= 10) { lockedUntil = now + 5 * 60 * 1000; wrongCount = 0; }
        }
        if (!ok) { try { Thread.sleep(800); } catch (InterruptedException ignored) { } }
        return ok;
    }

    private void send(OutputStream out, int code, String type, byte[] body) throws IOException {
        String status;
        switch (code) {
            case 200: status = "OK"; break;
            case 400: status = "Bad Request"; break;
            case 403: status = "Forbidden"; break;
            case 404: status = "Not Found"; break;
            case 405: status = "Method Not Allowed"; break;
            default: status = "Error";
        }
        String h = "HTTP/1.1 " + code + " " + status + "\r\n" +
                "Content-Type: " + type + "\r\n" +
                "Content-Length: " + body.length + "\r\n" +
                "Cache-Control: no-store\r\n" +
                "X-Content-Type-Options: nosniff\r\n" +
                "Connection: close\r\n\r\n";
        out.write(h.getBytes(UTF8));
        out.write(body);
    }

    private static String mime(String p) {
        String s = p.toLowerCase(Locale.ROOT);
        if (s.endsWith(".html")) return "text/html; charset=utf-8";
        if (s.endsWith(".css")) return "text/css; charset=utf-8";
        if (s.endsWith(".js")) return "application/javascript; charset=utf-8";
        if (s.endsWith(".json")) return "application/json";
        if (s.endsWith(".woff2")) return "font/woff2";
        if (s.endsWith(".svg")) return "image/svg+xml";
        if (s.endsWith(".png")) return "image/png";
        if (s.endsWith(".jpg") || s.endsWith(".jpeg")) return "image/jpeg";
        if (s.endsWith(".txt")) return "text/plain; charset=utf-8";
        return "application/octet-stream";
    }

    // ------------------------------------------------------------------ util

    /** Alamat IP box di jaringan lokal (WiFi / LAN). */
    public static String findIp() {
        try {
            String fallback = null;
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                String name = ni.getName().toLowerCase(Locale.ROOT);
                for (InetAddress a : Collections.list(ni.getInetAddresses())) {
                    if (!(a instanceof Inet4Address) || a.isLoopbackAddress()) continue;
                    String ip = a.getHostAddress();
                    if (name.startsWith("wlan") || name.startsWith("eth")) return ip;
                    if (a.isSiteLocalAddress() && fallback == null) fallback = ip;
                }
            }
            return fallback;
        } catch (Exception e) {
            return null;
        }
    }

    private static String esc(String s) { return s == null ? "" : s.replace("\\", "\\\\").replace("\"", "\\\""); }

    private static byte[] readAll(InputStream in) throws IOException {
        ByteArrayOutputStream o = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) > 0) o.write(buf, 0, n);
        return o.toByteArray();
    }

    private static byte[] readFile(File f) throws IOException {
        FileInputStream in = new FileInputStream(f);
        try { return readAll(in); } finally { in.close(); }
    }

    private static void writeAtomic(File f, byte[] data) throws IOException {
        File tmp = new File(f.getPath() + ".tmp");
        FileOutputStream o = new FileOutputStream(tmp);
        try {
            o.write(data);
            o.getFD().sync();
        } finally {
            o.close();
        }
        if (!tmp.renameTo(f)) {
            // beberapa sistem berkas tidak bisa menimpa lewat rename
            if (f.exists() && !f.delete()) throw new IOException("Gagal mengganti " + f);
            if (!tmp.renameTo(f)) throw new IOException("Gagal menyimpan " + f);
        }
    }
}
