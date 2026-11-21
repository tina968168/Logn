package com.ke.logn;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;

// 通知：克的话（ke）、提醒和日子（remind）两路；点了打开 app 跳到 route 那页
public class Note {
  static void channels(Context c) {
    if (Build.VERSION.SDK_INT < 26) return;
    NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
    nm.createNotificationChannel(new NotificationChannel("ke", "Ke", NotificationManager.IMPORTANCE_HIGH));
    nm.createNotificationChannel(new NotificationChannel("remind", "Reminders", NotificationManager.IMPORTANCE_HIGH));
  }

  static void show(Context c, String ch, int id, String title, String body, String route) {
    if (Build.VERSION.SDK_INT >= 33 && c.checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) return;
    channels(c);
    Intent i = new Intent(c, Main.class).putExtra("route", route).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
    PendingIntent pi = PendingIntent.getActivity(c, id, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(c, ch) : new Notification.Builder(c);
    b.setSmallIcon(R.drawable.note).setContentTitle(title).setContentText(body)
      .setStyle(new Notification.BigTextStyle().bigText(body)).setAutoCancel(true).setContentIntent(pi);
    ((NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE)).notify(id, b.build());
  }

  // 克的话来了：记下收到第几号（后台问信从这往后问）；show 才弹，同一号只弹一次
  static synchronized void ke(Context c, int seq, String text, boolean show) {
    SharedPreferences sp = c.getSharedPreferences("logn", Context.MODE_PRIVATE);
    if (seq <= sp.getInt("keSeq", 0)) return;
    sp.edit().putInt("keSeq", seq).commit();
    if (show) show(c, "ke", 1, "Ke", text, "chat");
  }
}
