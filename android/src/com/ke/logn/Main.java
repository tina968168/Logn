package com.ke.logn;

import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.HapticFeedbackConstants;
import android.view.View;
import android.webkit.*;
import java.io.*;
import java.util.ArrayList;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.json.JSONObject;

// 一层壳：页面整份在安装包里（https://logn.local/），不连网也能开。
// 网页要手机做的事都走 LognApp：服务器地址、响铃、克的话来了弹通知、存文件、震一下、系统栏颜色、点通知去哪页
public class Main extends Activity {
  static final String HOST = "logn.local";
  WebView web;
  ValueCallback<Uri[]> pick;
  String route;              // 点通知进来要去哪页，网页起来后拿一次
  static volatile boolean visible = false;   // 在前台时网页自己 30 秒问一次，后台的 Peek 就别再问、别弹

  @Override protected void onStart() { super.onStart(); visible = true; }
  // 退到后台：一分钟后开始每 3 分钟问一次
  @Override protected void onStop() { super.onStop(); visible = false; Peek.soon(this, 60 * 1000L); }

  @Override protected void onCreate(Bundle b) {
    super.onCreate(b);
    Note.channels(this);
    route = routeOf(getIntent());
    web = new WebView(this);
    WebSettings s = web.getSettings();
    s.setJavaScriptEnabled(true);
    s.setDomStorageEnabled(true);
    s.setDatabaseEnabled(true);
    s.setAllowFileAccess(false);
    s.setMediaPlaybackRequiresUserGesture(true);
    web.setWebViewClient(new WebViewClient() {
      // logn.local 的东西都从安装包里拿
      @Override public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
        Uri u = r.getUrl();
        if (!HOST.equals(u.getHost())) return null;
        String p = u.getPath();
        if (p == null || p.equals("/")) p = "/index.html";
        try {
          String m = mime(p);
          return new WebResourceResponse(m, m.startsWith("text") || m.contains("json") ? "utf-8" : null, getAssets().open("www" + p));
        } catch (IOException e) {
          WebResourceResponse x = new WebResourceResponse("text/plain", "utf-8", new ByteArrayInputStream(new byte[0]));
          x.setStatusCodeAndReasonPhrase(404, "Not Found");
          return x;
        }
      }
      // 别的网址交给手机自己打开
      @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
        if (HOST.equals(r.getUrl().getHost())) return false;
        try { startActivity(new Intent(Intent.ACTION_VIEW, r.getUrl())); } catch (Exception e) {}
        return true;
      }
    });
    web.setWebChromeClient(new WebChromeClient() {
      // 选图、视频、文件：可多选
      @Override public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> cb, FileChooserParams p) {
        if (pick != null) pick.onReceiveValue(null);
        pick = cb;
        Intent i = new Intent(Intent.ACTION_GET_CONTENT).addCategory(Intent.CATEGORY_OPENABLE);
        ArrayList<String> types = new ArrayList<String>();
        for (String t : p.getAcceptTypes()) for (String x : t.split(",")) if (x.trim().length() > 0) types.add(x.trim());
        if (types.size() == 1) i.setType(types.get(0));
        else { i.setType("*/*"); if (types.size() > 1) i.putExtra(Intent.EXTRA_MIME_TYPES, types.toArray(new String[0])); }
        if (p.getMode() == FileChooserParams.MODE_OPEN_MULTIPLE) i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        try { startActivityForResult(Intent.createChooser(i, null), 7); } catch (Exception e) { pick = null; return false; }
        return true;
      }
    });
    web.addJavascriptInterface(new Bridge(), "LognApp");
    setContentView(web);
    web.loadUrl("https://" + HOST + "/index.html");
    Peek.schedule(this);
    if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED)
      requestPermissions(new String[]{"android.permission.POST_NOTIFICATIONS"}, 9);
  }

  class Bridge {
    @JavascriptInterface public String server() { return Secret.SERVER; }
    @JavascriptInterface public String takeRoute() { String r = route; route = null; return r == null ? "" : r; }
    @JavascriptInterface public void setAlarms(String json) { Alarm.setAll(Main.this, json); }
    @JavascriptInterface public void keArrived(int seq, String text, boolean show) { Note.ke(Main.this, seq, text, show); }
    @JavascriptInterface public void haptic() {
      runOnUiThread(new Runnable() { public void run() { web.performHapticFeedback(HapticFeedbackConstants.KEYBOARD_TAP); } });
    }
    // 系统栏跟着页面顶上的颜色走；dark＝深色，图标换成白的
    @JavascriptInterface public void bars(final String rgb, final boolean dark) {
      runOnUiThread(new Runnable() { public void run() {
        Matcher m = Pattern.compile("(\\d+)\\D+(\\d+)\\D+(\\d+)").matcher(rgb == null ? "" : rgb);
        if (!m.find()) return;
        int c = Color.rgb(Integer.parseInt(m.group(1)), Integer.parseInt(m.group(2)), Integer.parseInt(m.group(3)));
        getWindow().setStatusBarColor(c);
        getWindow().setNavigationBarColor(c);
        int f = 0;
        if (!dark) { f |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR; if (Build.VERSION.SDK_INT >= 26) f |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR; }
        getWindow().getDecorView().setSystemUiVisibility(f);
      } });
    }
    // 存进手机「下载/Logn/」：导出备份、Chat 和大图的 Save
    @JavascriptInterface public boolean saveBase64(String name, String type, String b64) {
      try {
        byte[] data = Base64.decode(b64, Base64.DEFAULT);
        if (Build.VERSION.SDK_INT >= 29) {
          ContentValues v = new ContentValues();
          v.put(MediaStore.Downloads.DISPLAY_NAME, name);
          v.put(MediaStore.Downloads.MIME_TYPE, type);
          v.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Logn");
          Uri u = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, v);
          OutputStream o = getContentResolver().openOutputStream(u);
          try { o.write(data); } finally { o.close(); }
        } else {
          File d = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "Logn");
          d.mkdirs();
          FileOutputStream o = new FileOutputStream(new File(d, name));
          try { o.write(data); } finally { o.close(); }
        }
        return true;
      } catch (Exception e) { return false; }
    }
  }

  static String mime(String p) {
    if (p.endsWith(".html")) return "text/html";
    if (p.endsWith(".css")) return "text/css";
    if (p.endsWith(".js")) return "text/javascript";
    if (p.endsWith(".json")) return "application/json";
    if (p.endsWith(".woff2")) return "font/woff2";
    if (p.endsWith(".png")) return "image/png";
    if (p.endsWith(".svg")) return "image/svg+xml";
    return "application/octet-stream";
  }

  static String routeOf(Intent i) { return i == null ? null : i.getStringExtra("route"); }

  // app 开着时又点了通知：直接让网页跳过去
  @Override protected void onNewIntent(Intent i) {
    super.onNewIntent(i);
    String r = routeOf(i);
    if (r != null) web.evaluateJavascript("window.LognRoute && window.LognRoute(" + JSONObject.quote(r) + ")", null);
  }

  @Override protected void onActivityResult(int req, int res, Intent data) {
    if (req != 7 || pick == null) return;
    Uri[] out = null;
    if (res == RESULT_OK && data != null) {
      if (data.getClipData() != null) {
        out = new Uri[data.getClipData().getItemCount()];
        for (int i = 0; i < out.length; i++) out[i] = data.getClipData().getItemAt(i).getUri();
      } else if (data.getData() != null) out = new Uri[]{ data.getData() };
    }
    pick.onReceiveValue(out);
    pick = null;
  }

  // 返回键：网页先关卡片、侧栏，没东西可关了才退到后台
  @Override public void onBackPressed() {
    web.evaluateJavascript("window.LognBack ? window.LognBack() : false", new ValueCallback<String>() {
      public void onReceiveValue(String v) { if (!"true".equals(v)) moveTaskToBack(true); }
    });
  }
}
