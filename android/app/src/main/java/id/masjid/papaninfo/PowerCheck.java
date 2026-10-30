package id.masjid.papaninfo;

import android.content.BroadcastReceiver;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.provider.Settings;

/**
 * Memeriksa pengaturan box yang bisa membuat layar mati sendiri walaupun
 * aplikasi menahan layar tetap menyala, dan mencatat kapan layar box mati.
 *
 * - attentive_timeout (Android 10+, "Turn off display / When inactive"):
 *   memaksa box tidur bila remote tidak ditekan sekian lama; mengalahkan
 *   FLAG_KEEP_SCREEN_ON.
 * - sleep_timeout ("Put device to sleep" / "Auto sleep"): di sebagian box
 *   juga tetap membuat box tidur.
 */
final class PowerCheck implements LocalServer.Status {

    private static PowerCheck instance;

    private final Context ctx;
    private final SharedPreferences prefs;

    static synchronized PowerCheck get(Context c) {
        if (instance == null) instance = new PowerCheck(c.getApplicationContext());
        return instance;
    }

    private PowerCheck(Context c) {
        ctx = c;
        prefs = c.getSharedPreferences("power", Context.MODE_PRIVATE);
        // SCREEN_OFF/ON hanya bisa didengar lewat receiver yang didaftarkan saat berjalan;
        // didaftarkan sekali di konteks aplikasi dan hidup selama proses hidup
        IntentFilter f = new IntentFilter();
        f.addAction(Intent.ACTION_SCREEN_OFF);
        f.addAction(Intent.ACTION_SCREEN_ON);
        try {
            c.registerReceiver(new BroadcastReceiver() {
                @Override public void onReceive(Context x, Intent i) {
                    long now = System.currentTimeMillis();
                    if (Intent.ACTION_SCREEN_OFF.equals(i.getAction())) {
                        prefs.edit().putLong("lastOff", now).putInt("offCount", prefs.getInt("offCount", 0) + 1).apply();
                    } else {
                        prefs.edit().putLong("lastOn", now).apply();
                    }
                }
            }, f);
        } catch (Exception ignored) { }
    }

    /** Nilai pengaturan dalam milidetik; null bila tidak ada atau tidak bisa dibaca. */
    private Long readMs(boolean secure, String key) {
        try {
            ContentResolver cr = ctx.getContentResolver();
            String v = secure ? Settings.Secure.getString(cr, key) : Settings.System.getString(cr, key);
            if (v == null) return null;
            return Long.parseLong(v.trim());
        } catch (Exception e) {
            return null;
        }
    }

    private static String num(Long v) { return v == null ? "null" : String.valueOf(v); }

    @Override
    public String json() {
        return "{\"attentiveTimeout\":" + num(readMs(true, "attentive_timeout")) +
                ",\"sleepTimeout\":" + num(readMs(true, "sleep_timeout")) +
                ",\"screenOffTimeout\":" + num(readMs(false, Settings.System.SCREEN_OFF_TIMEOUT)) +
                ",\"lastOff\":" + prefs.getLong("lastOff", 0) +
                ",\"lastOn\":" + prefs.getLong("lastOn", 0) +
                ",\"offCount\":" + prefs.getInt("offCount", 0) +
                ",\"now\":" + System.currentTimeMillis() + "}";
    }
}
