package com.ke.logn;

import android.app.job.JobInfo;
import android.app.job.JobParameters;
import android.app.job.JobScheduler;
import android.app.job.JobService;
import android.content.ComponentName;
import android.content.Context;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import org.json.JSONObject;

// app 不在前台时去问服务器：克有新话就弹。只问不拿，打开 app 时网页自己去拿。
// 两条腿：退到后台起每 3 分钟问一次（一次性的任务，跑完再排下一次）；另有每 15 分钟一次的兜底（安卓周期任务最短就是 15 分钟）
public class Peek extends JobService {
  static final int JOB = 1, SOON = 2;
  static final long GAP = 3 * 60 * 1000L;

  static void schedule(Context c) {
    JobScheduler js = (JobScheduler) c.getSystemService(Context.JOB_SCHEDULER_SERVICE);
    if (js == null) return;
    for (JobInfo j : js.getAllPendingJobs()) if (j.getId() == JOB) return;
    js.schedule(new JobInfo.Builder(JOB, new ComponentName(c, Peek.class))
      .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
      .setPeriodic(15 * 60 * 1000L)
      .setPersisted(true).build());
  }

  // 过 wait 毫秒问一次（同一号的任务会顶掉上一个，所以不会越排越多）
  static void soon(Context c, long wait) {
    JobScheduler js = (JobScheduler) c.getSystemService(Context.JOB_SCHEDULER_SERVICE);
    if (js == null) return;
    js.schedule(new JobInfo.Builder(SOON, new ComponentName(c, Peek.class))
      .setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY)
      .setMinimumLatency(wait)
      .setOverrideDeadline(wait + 2 * 60 * 1000L)
      .setPersisted(true).build());
  }

  @Override public boolean onStartJob(final JobParameters p) {
    new Thread(new Runnable() { public void run() {
      try { if (!Main.visible) look(Peek.this); } catch (Throwable ignore) {}
      if (p.getJobId() == SOON && !Main.visible) soon(Peek.this, GAP);     // 还在后台就接着排下一次
      jobFinished(p, false);
    } }).start();
    return true;
  }
  @Override public boolean onStopJob(JobParameters p) { return true; }

  static void look(Context c) throws Exception {
    if (Secret.SERVER.isEmpty()) return;          // 没配服务器：只存在手机上，不去问
    int after = c.getSharedPreferences("logn", Context.MODE_PRIVATE).getInt("keSeq", 0);
    HttpURLConnection h = (HttpURLConnection) new URL(Secret.SERVER + "/logn/peek?after=" + after).openConnection();
    h.setConnectTimeout(8000); h.setReadTimeout(15000);
    if (h.getResponseCode() != 200) { h.disconnect(); return; }
    ByteArrayOutputStream b = new ByteArrayOutputStream();
    InputStream in = h.getInputStream();
    try { byte[] x = new byte[8192]; int n; while ((n = in.read(x)) > 0) b.write(x, 0, n); } finally { in.close(); h.disconnect(); }
    JSONObject j = new JSONObject(b.toString("UTF-8"));
    int n = j.optInt("n"), upTo = j.optInt("last");
    if (n > 0) Note.ke(c, upTo, n > 1 ? n + " messages · " + j.optString("text") : j.optString("text"), true);
  }
}
