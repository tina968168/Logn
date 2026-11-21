// 手机那层：装在手机上时由 Java 壳提供 window.LognApp；网页预览时用替身，页面代码不分两套
const A = window.LognApp || null;
export const inApp = !!A;

// 全部响铃一次交给手机（手机按时弹通知，开机后自己重排）。list: [{key, at（毫秒）, title, body, route}]
export function setAlarms(list) {
  if (A && A.setAlarms) { try { A.setAlarms(JSON.stringify(list)); } catch (e) { console.error(e); } }
  else window.__lognAlarms = list;      // 预览和测试时看这里
}
export function haptic() { if (A && A.haptic) { try { A.haptic(); } catch (e) {} } }
// 存文件到手机：app 里存进「下载/Logn/」（壳的 saveBase64），网页里直接下载
export async function saveBlob(name, blob) {
  if (A && A.saveBase64) {
    try {
      const b64 = await new Promise((ok, bad) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(",")[1] || ""); r.onerror = bad; r.readAsDataURL(blob); });
      return !!A.saveBase64(name, blob.type || "application/octet-stream", b64);
    } catch (e) { return false; }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return true;
}
// 导出备份
export const saveFile = (name, text) => saveBlob(name, new Blob([text], { type: "application/json" }));
// 点通知进来时，壳会调 window.LognRoute("reminders/abc")
export function onRoute(fn) {
  window.LognRoute = r => fn(String(r || ""));
  if (A && A.takeRoute) { try { const r = A.takeRoute(); if (r) setTimeout(() => fn(r), 0); } catch (e) {} }
}
// 返回键：壳调 window.LognBack()，返回 true 表示网页自己处理了
export function onBack(fn) { window.LognBack = () => !!fn(); }
// 服务器地址（带暗号）：壳打包时写进去，网页代码里不放；网页预览、测试里没有，就不连
export const serverBase = () => { try { return A && A.server ? String(A.server() || "") : ""; } catch (e) { return ""; } };
// 克的话拿回来了：告诉壳收到第几号（后台问信从这号往后问）；show＝弹一条系统通知（用户不在 Chat 或 app 在后台）
export function keArrived(seq, text, show) { if (A && A.keArrived) { try { A.keArrived(seq, String(text || ""), !!show); } catch (e) {} } }
// 手机顶上、底下两条系统栏：跟着页面顶上的颜色和深浅变
export function bars(rgb, dark) { if (A && A.bars) { try { A.bars(rgb, !!dark); } catch (e) {} } }
