// 共用的界面件：从下面上来的卡片、对话框、提示；返回键先关最上面那层
const $ = id => document.getElementById(id);
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export function h(html) { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; }

const layers = [];             // 开着的层，最上面的在最后：{close}
export const anyOpen = () => layers.length > 0;
export function back() { const top = layers[layers.length - 1]; if (!top) return false; top.close(); return true; }
export function pushLayer(close) { const l = { close }; layers.push(l); return () => { const i = layers.indexOf(l); if (i >= 0) layers.splice(i, 1); }; }

// 提示
let toastTimer = 0;
export function toast(msg) {
  const t = $("toast"); t.textContent = msg; t.classList.add("on");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("on"), 1800);
}

// 对话框：返回 Promise<boolean>
export function confirm(msg, ok = "OK", danger = false) {
  return new Promise(resolve => {
    const w = $("dialogWrap"), d = $("dialog");
    w.classList.remove("low"); d.className = "dialog";
    d.innerHTML = `<p>${esc(msg)}</p><div class="acts"><button data-v="0">Cancel</button><button data-v="1" class="${danger ? "red" : ""}">${esc(ok)}</button></div>`;
    w.classList.add("on");
    let off;
    const done = v => { off(); w.classList.remove("on"); w.onclick = null; resolve(v); };
    off = pushLayer(() => done(false));
    w.onclick = e => { const b = e.target.closest("[data-v]"); if (b) done(b.dataset.v === "1"); else if (e.target === w) done(false); };
  });
}

// 从下面弹一组选项，最下面单独一个 Cancel：list = [{v, label, red}]，返回选的 v，取消返回 null
export function actions(list) {
  return new Promise(resolve => {
    const w = $("dialogWrap"), d = $("dialog");
    w.classList.add("low"); d.className = "dialog acts-sheet";
    d.innerHTML = `<div class="g">${list.map((x, i) => `<button data-i="${i}" class="${x.red ? "red" : ""}">${esc(x.label)}</button>`).join("")}</div><div class="g"><button data-i="-1" class="c">Cancel</button></div>`;
    w.classList.add("on");
    let off;
    const done = v => { off(); w.classList.remove("on"); w.onclick = null; resolve(v); };
    off = pushLayer(() => done(null));
    w.onclick = e => { const b = e.target.closest("[data-i]"); if (b) done(+b.dataset.i < 0 ? null : list[+b.dataset.i].v); else if (e.target === w) done(null); };
  });
}

// 卡片：left / right 是左上右上的按钮 {label, run, disabled}；body 是元素；foot 是最下面一排（比如 Delete）
// guard：关之前先问，返回 true 才关（Cancel、返回键、点外面都过它；开新卡片顶替时不问）
// 一次只开一张，开新的会顶替旧的
let current = null;
export function sheet({ title = "", left, right, body, foot, onClose, guard }) {
  if (current) current.close(true);
  const w = $("sheetWrap"), s = $("sheet");
  s.innerHTML = "";
  const top = h(`<div class="sheet-top"><button class="link" data-k="l"></button><b></b><button class="link" data-k="r"></button></div>`);
  top.querySelector("b").textContent = title;
  const L = top.querySelector('[data-k="l"]'), R = top.querySelector('[data-k="r"]');
  const setBtn = (el, b) => { if (!b) { el.style.visibility = "hidden"; return; } el.textContent = b.label; el.disabled = !!b.disabled; el.onclick = () => b.run(api); };
  setBtn(L, left); setBtn(R, right);
  const bd = h(`<div class="sheet-body"></div>`);
  if (body) bd.appendChild(body);
  if (foot) { const f = h(`<div class="sheet-foot"></div>`); f.appendChild(foot); bd.appendChild(f); }
  s.appendChild(top); s.appendChild(bd);
  w.classList.add("on");
  let off;
  const api = {
    async close(silent) {
      if (current !== api) return;
      if (!silent && guard && !(await guard())) return;
      if (current !== api) return;
      current = null; off(); w.classList.remove("on"); w.onclick = null; if (!silent && onClose) onClose(); },
    setRight(b) { setBtn(R, b); R.style.visibility = b ? "" : "hidden"; },
    body: bd,
  };
  off = pushLayer(() => api.close());
  w.onclick = e => { if (e.target === w) api.close(); };
  current = api;
  return api;
}
