// 长按一条：气泡上方（放不下就下方）一条深色小工具，带尖角指着那句：Reply、Copy、Edit、Star、Select、Delete
import * as db from "../../core/db.js";
import { h, toast, confirm, pushLayer } from "../../core/ui.js";
import { I } from "../../core/icons.js";
import { S, ROOM, mediaOf } from "./state.js";
import { sel, paint } from "./view.js";
import { stopAudio } from "./audio.js";
import { startReply, startEdit } from "./compose.js";

// 长按松手时浏览器还会补一个点击，这个点击不算
let justPressed = false;
export const swallowClick = () => { const was = justPressed; justPressed = false; return was; };

export function watchPress() {
  const sc = S.sc;
  let timer = 0, x0 = 0, y0 = 0;
  const stop = () => clearTimeout(timer);
  sc.addEventListener("pointerdown", e => {
    const m = e.target.closest("[data-msg]"); if (!m || sel.on) return;
    x0 = e.clientX; y0 = e.clientY;
    timer = setTimeout(() => { justPressed = true; tools(m.dataset.msg); }, 450);
  });
  sc.addEventListener("pointermove", e => { if (Math.abs(e.clientX - x0) > 8 || Math.abs(e.clientY - y0) > 8) stop(); });
  ["pointerup", "pointercancel", "scroll"].forEach(k => sc.addEventListener(k, stop, { passive: true }));
  sc.addEventListener("contextmenu", e => {
    const m = e.target.closest("[data-msg]"); if (!m || sel.on) return;
    e.preventDefault(); stop(); justPressed = false; tools(m.dataset.msg);
  });
}

function tools(id) {
  const m = S.list.find(x => x.id === id); if (!m) return;
  const box = S.sc.querySelector(`[data-msg="${id}"]`), r = box.getBoundingClientRect(), pr = S.el.getBoundingClientRect();
  const items = [
    ["reply", "Reply"],
    m.text ? ["copy", "Copy"] : null,
    m.by !== "ke" && m.text && !m.kind ? ["edit", "Edit"] : null,      // 只能改自己写的字
    ["star", m.star ? "Unstar" : "Star"],
    ["sel", "Select"],
    ["del", "Delete"],
  ].filter(Boolean);
  const layer = h(`<div class="ch-dim"><div class="ch-tools">${items.map(([k, l]) => `<button data-k="${k}" class="${k === "del" ? "red" : ""}">${I[k === "del" ? "trash" : k]}<span>${l}</span></button>`).join("")}<i class="ch-arrow"></i></div></div>`);
  S.el.appendChild(layer);
  box.classList.add("lift");
  // 放在气泡正上方，左右不出屏；上面放不下就放下面，尖角跟着翻
  const tb = layer.querySelector(".ch-tools"), w = tb.offsetWidth, hh = tb.offsetHeight;
  const cx = r.left + r.width / 2 - pr.left;
  const left = Math.max(10, Math.min(pr.width - w - 10, cx - w / 2));
  const above = r.top - pr.top - hh - 12 > 8;
  tb.style.left = left + "px";
  tb.style.top = (above ? r.top - pr.top - hh - 12 : r.bottom - pr.top + 12) + "px";
  const ar = layer.querySelector(".ch-arrow");
  ar.classList.add(above ? "down" : "up");
  ar.style.left = Math.max(16, Math.min(w - 16, cx - left)) - 6 + "px";
  let off;
  const close = () => { off(); layer.remove(); box.classList.remove("lift"); };
  off = pushLayer(close);
  layer.onclick = async e => {
    const b = e.target.closest("[data-k]");
    close();
    if (!b) return;
    const k = b.dataset.k;
    if (k === "reply") startReply(m);
    if (k === "copy") copy(m.text);
    if (k === "edit") startEdit(m);
    if (k === "star") { await db.put(ROOM, { ...m, star: !m.star }); toast(m.star ? "Unstarred" : "Starred"); }
    if (k === "sel") { sel.set(true); sel.picked.add(m.id); paint(); }
    if (k === "del" && await confirm("Delete this message? This can't be undone.", "Delete", true)) await removeOne(m);
  };
}

// 删一条：连它的图、视频、封面、文件一起删
async function removeOne(m) {
  await db.del(ROOM, m.id);
  const x = mediaOf(m);
  if (x.pics.length) await db.delMany("pics", x.pics);
  if (x.files.length) { stopAudio(x.files[0]); await db.delMany("files", x.files); }
  toast("Deleted");
}
async function copy(t) {
  try { await navigator.clipboard.writeText(t); }
  catch (e) { const a = document.createElement("textarea"); a.value = t; document.body.appendChild(a); a.select(); document.execCommand("copy"); a.remove(); }
  toast("Copied");
}
