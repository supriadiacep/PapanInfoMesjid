package id.masjid.papaninfo;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.res.AssetManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import android.window.OnBackInvokedCallback;
import android.window.OnBackInvokedDispatcher;

import java.io.IOException;
import java.io.InputStream;

/**
 * Layar penuh berisi WebView yang menampilkan papan info masjid.
 * Halaman disajikan oleh LocalServer (lihat kelas itu) supaya bisa
 * diatur juga dari HP yang tersambung ke WiFi yang sama.
 */
public class MainActivity extends Activity {

    private static final int FILE_CHOOSER = 7;
    private static LocalServer server;

    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private final Handler handler = new Handler(Looper.getMainLooper());

    static synchronized LocalServer ensureServer(Activity a) {
        if (server == null) {
            final AssetManager am = a.getApplicationContext().getAssets();
            String ver = "1.0";
            try { ver = a.getPackageManager().getPackageInfo(a.getPackageName(), 0).versionName; } catch (Exception ignored) { }
            server = new LocalServer(new LocalServer.Assets() {
                @Override public InputStream open(String path) throws IOException { return am.open(path); }
            }, a.getFilesDir(), ver);
        }
        return server;
    }

    @SuppressLint({"SetJavaScriptEnabled", "AddJavascriptInterface"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_FULLSCREEN
                | WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);

        web = new WebView(this);
        web.setBackgroundColor(0xFF0E2B2D);
        setContentView(web);
        hideSystemUi();

        // Android 13 ke atas memakai cara baru untuk tombol Kembali (onBackPressed
        // tidak dipanggil lagi sejak targetSdk 36)
        if (Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                    OnBackInvokedDispatcher.PRIORITY_DEFAULT, new OnBackInvokedCallback() {
                        @Override public void onBackInvoked() { backToSchedule(); }
                    });
        }

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setTextZoom(100);
        s.setAllowFileAccess(false);
        s.setUserAgentString(s.getUserAgentString() + " MasjidTV/1.0");
        s.setCacheMode(WebSettings.LOAD_NO_CACHE);

        web.addJavascriptInterface(new Bridge(), "Android");
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = cb;
                try {
                    startActivityForResult(params.createIntent(), FILE_CHOOSER);
                } catch (ActivityNotFoundException e) {
                    fileCallback = null;
                    Toast.makeText(MainActivity.this, "Tidak ada aplikasi pengelola file", Toast.LENGTH_LONG).show();
                    return false;
                }
                return true;
            }
        });
        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onReceivedError(WebView v, WebResourceRequest req, WebResourceError err) {
                if (Build.VERSION.SDK_INT >= 21 && req.isForMainFrame()) retryLater();
            }

            @Override
            public boolean onRenderProcessGone(WebView v, RenderProcessGoneDetail d) {
                // jika mesin browser berhenti, buat ulang layar agar papan info tetap tampil
                recreate();
                return true;
            }
        });

        startAndLoad();
    }

    private void startAndLoad() {
        new Thread(new Runnable() {
            @Override public void run() {
                try {
                    ensureServer(MainActivity.this).start();
                    handler.post(new Runnable() {
                        @Override public void run() { web.loadUrl(server.localUrl("/index.html")); }
                    });
                } catch (final IOException e) {
                    handler.post(new Runnable() {
                        @Override public void run() {
                            Toast.makeText(MainActivity.this, "Server lokal gagal berjalan: " + e.getMessage(), Toast.LENGTH_LONG).show();
                            retryLater();
                        }
                    });
                }
            }
        }).start();
    }

    private void retryLater() {
        handler.removeCallbacksAndMessages(null);
        handler.postDelayed(new Runnable() {
            @Override public void run() { startAndLoad(); }
        }, 4000);
    }

    private void hideSystemUi() {
        View d = getWindow().getDecorView();
        d.setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemUi();
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        // tombol Menu / Pengaturan di remote membuka halaman pengaturan
        int k = e.getKeyCode();
        if ((k == KeyEvent.KEYCODE_MENU || k == KeyEvent.KEYCODE_SETTINGS) && server != null) {
            if (e.getAction() == KeyEvent.ACTION_UP) web.loadUrl(server.localUrl("/admin.html"));
            return true;
        }
        return super.dispatchKeyEvent(e);
    }

    @Override
    public void onBackPressed() {
        backToSchedule();
    }

    private void backToSchedule() {
        // aplikasi ini bisa menjadi layar utama (launcher), jadi tombol Kembali
        // tidak menutup aplikasi, hanya kembali ke layar jadwal
        if (web != null && server != null) {
            String u = web.getUrl();
            if (u != null && u.contains("/index.html")) return;
            web.loadUrl(server.localUrl("/index.html"));
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        // tombol Home ditekan saat aplikasi sudah terbuka: kembali ke layar jadwal
        if (web != null && server != null && server.getPort() > 0) web.loadUrl(server.localUrl("/index.html"));
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == FILE_CHOOSER && fileCallback != null) {
            fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
            fileCallback = null;
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        if (web != null) web.destroy();
        super.onDestroy();
    }

    /** Fungsi yang bisa dipanggil dari halaman (window.Android). */
    private class Bridge {
        @JavascriptInterface
        public void openSystemSettings() {
            runOnUiThread(new Runnable() {
                @Override public void run() {
                    try {
                        startActivity(new Intent(Settings.ACTION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
                    } catch (Exception e) {
                        Toast.makeText(MainActivity.this, "Pengaturan Android tidak bisa dibuka", Toast.LENGTH_LONG).show();
                    }
                }
            });
        }

        @JavascriptInterface
        public void openDateSettings() {
            runOnUiThread(new Runnable() {
                @Override public void run() {
                    try {
                        startActivity(new Intent(Settings.ACTION_DATE_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
                    } catch (Exception e) {
                        try {
                            startActivity(new Intent(Settings.ACTION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
                        } catch (Exception e2) {
                            Toast.makeText(MainActivity.this, "Pengaturan tanggal tidak bisa dibuka", Toast.LENGTH_LONG).show();
                        }
                    }
                }
            });
        }

        @JavascriptInterface
        public String version() {
            try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionName; } catch (Exception e) { return "1.0"; }
        }
    }
}
