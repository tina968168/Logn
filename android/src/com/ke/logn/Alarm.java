package com.ke.logn;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import org.json.JSONArray;
import org.json.JSONObject;

// 响铃：网页把全部提醒一次交过来（[{key, at 毫秒, title, body, route}]），这里按点排好；到点弹通知；开机后重排
public class Alarm extends BroadcastReceiver {
  static synchronized void setAll(Context c, String json) {
    c.getSharedPreferences("logn", Context.MODE_PRIVATE).edit().putString("alarms", json).commit();
    plan(c);
  }

  static synchronized void plan(Context c) {
    SharedPreferences sp = c.getSharedPreferences("logn", Context.MODE_PRIVATE);
    AlarmManager am = (AlarmManager) c.getSystemService(Context.ALARM_SERVICE);
    int old = sp.getInt("alarmN", 0);
    for (int i = 0; i < old; i++) {                 // 先把上回排的全撤掉
      PendingIntent pi = PendingIntent.getBroadcast(c, 1000 + i, new Intent(c, Alarm.class), PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE);
      if (pi != null) { am.cancel(pi); pi.cancel(); }
    }
    int n = 0;
    try {
      JSONArray a = new JSONArray(sp.getString("alarms", "[]"));
      long now = System.currentTimeMillis();
      boolean exact = Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms();
      for (int i = 0; i < a.length(); i++) {
        JSONObject o = a.getJSONObject(i);
        long at = o.optLong("at");
        if (at <= now) continue;
        Intent it = new Intent(c, Alarm.class).putExtra("key", o.optString("key")).putExtra("title", o.optString("title"))
          .putExtra("body", o.optString("body")).putExtra("route", o.optString("route"));
        PendingIntent pi = PendingIntent.getBroadcast(c, 1000 + n, it, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        if (exact) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        n++;
      }
    } catch (Exception ignore) {}
    sp.edit().putInt("alarmN", n).commit();
  }

  @Override public void onReceive(Context c, Intent i) {
    if (Intent.ACTION_BOOT_COMPLETED.equals(i.getAction())) { plan(c); return; }
    Note.show(c, "remind", (i.getStringExtra("key") + "").hashCode(), i.getStringExtra("title"), i.getStringExtra("body"), i.getStringExtra("route"));
  }
}
