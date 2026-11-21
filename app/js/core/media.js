// 图、视频、音频、文件、头像：Notes 和 Chat 共用
// 图压到长边 1600 存 pics；视频、音频、别的文件原样存 files（视频另存一张封面图在 pics）；头像压小存 avatars
// 显示用临时地址，东西删了地址也收回
import * as db from "./db.js";
import { on } from "./bus.js";
import { pushLayer, h, toast } from "./ui.js";
import { saveBlob } from "./native.js";

export const MAX_FILE = 200 * 1024 * 1024;     // 一个文件最大 200 MB（手机里存得下，传得动）
const urls = new Map();                          // id → 临时地址（几个仓库的 id 不会重）

// 打开系统选东西（可多选），取消返回 []。accept：image/*、image/*,video/*、空＝什么都行
export function pick(accept = "image/*", multiple = true) {
  return new Promise(resolve => {
    const i = document.createElement("input");
    i.type = "file"; if (accept) i.accept = accept; i.multiple = multiple;
    i.onchange = () => resolve([...i.files]);
    i.oncancel = () => resolve([]);
    i.click();
  });
}
export const isImage = f => /^image\//.test(f.type);
export const isVideo = f => /^video\//.test(f.type);
export const isAudio = f => /^audio\//.test(f.type) || /\.(mp3|m4a|aac|wav|ogg|flac)$/i.test(f.name || "");

// 压图：长边不超过 long，存 jpg；读不了的（格式不认）返回 null
async function draw(src, w0, h0, long) {
  const k = Math.min(1, long / Math.max(w0, h0));
  const w = Math.round(w0 * k), hgt = Math.round(h0 * k);
  const c = document.createElement("canvas"); c.width = w; c.height = hgt;
  const g = c.getContext("2d");
  g.fillStyle = "#fff"; g.fillRect(0, 0, w, hgt);       // 透明的地方填白，别变黑
  g.drawImage(src, 0, 0, w, hgt);
  const blob = await new Promise(r => c.toBlob(r, "image/jpeg", 0.85));
  return blob ? { blob, w, h: hgt } : null;
}
export async function shrink(file, long = 1600) {
  try {
    const bmp = await createImageBitmap(file);           // 手机拍的照片按它自己的方向摆正
    const out = await draw(bmp, bmp.width, bmp.height, long);
    if (bmp.close) bmp.close();
    return out;
  } catch (e) { return null; }
}

// 视频：取第一帧当封面，顺带拿时长；音频只拿时长。读不了的给 null
function loadMedia(file, tag) {
  return new Promise(resolve => {
    const m = document.createElement(tag), u = URL.createObjectURL(file);
    let done = false;
    const end = v => { if (done) return; done = true; URL.revokeObjectURL(u); resolve(v); };
    m.preload = "metadata"; m.muted = true; m.playsInline = true;
    m.onerror = () => end(null);
    setTimeout(() => end(null), 8000);
    if (tag === "audio") m.onloadedmetadata = () => end({ dur: m.duration });
    else {
      m.onloadeddata = () => { m.currentTime = Math.min(0.1, (m.duration || 1) / 2); };
      m.onseeked = async () => end({ dur: m.duration, poster: m.videoWidth ? await draw(m, m.videoWidth, m.videoHeight, 800) : null });
    }
    m.src = u;
  });
}
export const videoInfo = f => loadMedia(f, "video");
export const audioInfo = f => loadMedia(f, "audio");

// 存
export async function savePic(p) { return (await db.put("pics", { blob: p.blob, w: p.w, h: p.h }, { quiet: true })).id; }
export async function saveFile(file, extra = {}) { return (await db.put("files", { blob: file, name: file.name || "file", type: file.type || "", size: file.size, ...extra }, { quiet: true })).id; }

// 显示用的地址：有缓存直接给（画列表时不闪），没有就去仓库拿
export const cached = id => urls.get(id) || "";
export async function url(id, room = "pics") {
  if (urls.has(id)) return urls.get(id);
  const p = await db.get(room, id);
  if (!p || !p.blob) return "";
  const u = URL.createObjectURL(p.blob); urls.set(id, u); return u;
}
// 把 root 里还没填上的 <img data-pic>（data-room 指仓库，默认 pics）填上
export async function fill(root) {
  for (const im of root.querySelectorAll("img[data-pic]")) if (!im.getAttribute("src")) { const u = await url(im.dataset.pic, im.dataset.room || "pics"); if (u) im.src = u; }
}
// 东西删了，临时地址也收回
on("change", e => {
  if (!["pics", "files", "avatars"].includes(e.room) || !e.gone) return;
  (e.ids || [e.id]).forEach(id => { const u = urls.get(id); if (u) { URL.revokeObjectURL(u); urls.delete(id); } });
});

// 存到手机里（下载）
export async function download(id) {
  const f = await db.get("files", id);
  if (f) return saveBlob(f.name, f.blob);
  const p = await db.get("pics", id);
  if (p) return saveBlob("logn-" + id + ".jpg", p.blob);
  return false;
}

export const sizeWord = n => n < 1024 ? n + " B" : n < 1048576 ? Math.round(n / 1024) + " KB" : (n / 1048576).toFixed(n < 10485760 ? 1 : 0) + " MB";
// 时长：读不出（有的录屏视频报无限长）就不写
export const durWord = s => { if (!isFinite(s)) return ""; s = Math.round(s || 0); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };

// 看大图／放视频：黑底放满；右上 Save 存到手机、× 关；图点一下也关；返回键关
export function view({ src, video = false, id = null }) {
  const v = document.getElementById("viewer");
  v.innerHTML = "";
  const media = video ? h(`<video controls playsinline autoplay></video>`) : h(`<img alt="">`);
  media.src = src; v.appendChild(media);
  const bar = h(`<div class="viewer-bar">${id ? `<button class="viewer-btn" data-k="save">Save</button>` : ""}<button class="viewer-btn" data-k="x" aria-label="Close">×</button></div>`);
  v.appendChild(bar);
  v.hidden = false;
  const off = pushLayer(() => close());
  const close = () => { off(); if (video) media.pause(); v.hidden = true; v.innerHTML = ""; v.onclick = null; };
  v.onclick = async e => {
    const b = e.target.closest("[data-k]");
    if (b && b.dataset.k === "save") { if (await download(id)) toast("Saved"); return; }
    if (b || (!video && e.target === media) || e.target === v) close();
  };
}
