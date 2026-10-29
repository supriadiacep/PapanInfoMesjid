package id.masjid.papaninfo;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/**
 * Membuka papan info otomatis setelah box menyala.
 * Catatan: di Android 10 ke atas sistem bisa menahan cara ini; karena itu
 * cara paling andal adalah menjadikan aplikasi ini sebagai layar utama (Home).
 */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent intent) {
        String a = intent == null ? null : intent.getAction();
        if (a == null) return;
        if (a.equals(Intent.ACTION_BOOT_COMPLETED) || a.equals("android.intent.action.QUICKBOOT_POWERON")
                || a.equals("com.htc.intent.action.QUICKBOOT_POWERON") || a.equals(Intent.ACTION_MY_PACKAGE_REPLACED)) {
            Intent i = new Intent(ctx, MainActivity.class);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            try { ctx.startActivity(i); } catch (Exception ignored) { }
        }
    }
}
