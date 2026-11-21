// 下面写和发：回复／改的小条、左下 +（照片或视频、文件）、输入框、发送
import * as db from "../../core/db.js";
import * as M from "../../core/media.js";
import { h, esc, toast, pushLayer } from "../../core/ui.js";
import { I } from "../../core/icons.js";
import { S, ROOM } from "./state.js";
import { gist } from "./bubble.js";
import { toBottom } from "./view.js";

let replyTo = null, editing = null;
const ta = () => S.el.querySelector("#chText");

export const composeHtml = `<div class="ch-bottom">
  <div class="ch-note" hidden><div class="ch-note-text"></div><button class="ch-note-x" aria-label="Cancel">${I.x}</button></div>
  <div class="ch-in">
    <button class="ch-btn" id="chPlus" aria-label="Send photo, video or file">${I.add}</button>
    <textarea id="chText" rows="1" placeholder="Message"></textarea>
    <button class="ch-btn ch-send" id="chSend" aria-label="Send">${I.send}</button>
  </div>
</div>`;

export function watchCompose() {
  ta().addEventListener("input", () => { fit(); paintSend(); });
  S.el.querySelector("#chSend").onclick = send;
  S.el.querySelector("#chPlus").onclick = plusMenu;
  S.el.querySelector(".ch-note-x").onclick = () => { if (editing) ta().value = ""; setNote(null, null); fit(); paintSend(); };
}
export function startReply(m) { setNote("reply", m); ta().focus(); }
export function startEdit(m) { ta().value = m.text; setNote("edit", m); fit(); paintSend(); }

// 输入框跟着字长高（算上上下两条边），到 120 才在框里滚；没到时不许滚，不然右边会冒出一条滚动条
function fit() { const t = ta(); t.style.height = "auto"; const need = t.scrollHeight + 2; t.style.height = Math.min(need, 120) + "px"; t.style.overflowY = need > 120 ? "auto" : "hidden"; }
// 有字发送键才变深
function paintSend() { S.el.querySelector("#chSend").classList.toggle("on", !!ta().value.trim()); }
// 输入框上面一小条：在回复谁／在改哪句，× 取消
function setNote(kind, m) {
  replyTo = kind === "reply" ? m.id : null; editing = kind === "edit" ? m : null;
  const n = S.el.querySelector(".ch-note");
  n.hidden = !kind;
  if (kind) n.querySelector(".ch-note-text").innerHTML = (kind === "reply" ? `<b>Reply to ${m.by === "ke" ? "Ke" : "yourself"}</b>` : `<b>Editing</b>`) + `<span>${esc(gist(m))}</span>`;
}
async function send() {
  const t = ta().value.trim();
  if (!t) return;
  if (editing) { await db.put(ROOM, { ...editing, text: t, editedAt: Date.now() }); toast("Saved"); }
  else await db.put(ROOM, { text: t, replyTo: replyTo || null, by: "me" });
  ta().value = ""; setNote(null, null); fit(); paintSend(); toBottom();
}

// + ：从按钮上方弹一个小框（带尖角）：照片或视频、文件
function plusMenu() {
  const layer = h(`<div class="ch-dim"><div class="ch-plus">
    <button data-k="media"><span class="ch-fi">${I.img}</span>Photo or video</button>
    <button data-k="file"><span class="ch-fi">${I.doc}</span>File</button>
    <i class="ch-arrow down"></i></div></div>`);
  S.el.appendChild(layer);
  let off;
  const close = () => { off(); layer.remove(); };
  off = pushLayer(close);
  layer.onclick = e => { const b = e.target.closest("[data-k]"); close(); if (b) sendFiles(b.dataset.k); };
}
// 图压了几张一条；视频原样存、第一帧当封面；音频、别的文件原样存；一个最大 200 MB
async function sendFiles(kind) {
  const files = await M.pick(kind === "media" ? "image/*,video/*" : "", true);
  if (!files.length) return;
  if (files.some(f => f.size > M.MAX_FILE)) toast(`Too big (max ${M.sizeWord(M.MAX_FILE)})`);
  const pics = [];
  let bad = 0;
  for (const f of files.filter(x => x.size <= M.MAX_FILE)) {
    if (kind === "media" && M.isImage(f)) { const p = await M.shrink(f); if (p) pics.push(await M.savePic(p)); else bad++; continue; }
    if (M.isVideo(f)) {
      const info = await M.videoInfo(f);
      const poster = info && info.poster ? await M.savePic(info.poster) : null;
      const file = await M.saveFile(f);
      await db.put(ROOM, { kind: "video", file, poster, dur: info ? info.dur : 0, name: f.name, size: f.size, by: "me" });
      continue;
    }
    const audioish = M.isAudio(f), info = audioish ? await M.audioInfo(f) : null;
    const file = await M.saveFile(f);
    await db.put(ROOM, { kind: audioish ? "audio" : "file", file, name: f.name, size: f.size, dur: info ? info.dur : 0, by: "me" });
  }
  if (pics.length) await db.put(ROOM, { pics, by: "me" });
  if (bad) toast(bad === 1 ? "Couldn't read 1 photo" : `Couldn't read ${bad} photos`);
  toBottom();
}
