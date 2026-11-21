// 上下滑的滚轮：一列一列拼起来，中间那格是选中的
import { h, esc } from "./ui.js";

export const ROW = 40;          // 每格高度，跟 css 的 --wheel-row 一致
const SIDE = 2;                 // 中间那格上下各露两格

// 一列：items = [{v, label}]，返回 {el, get(), set(v), setItems(items, v)}
export function column(items, value, onChange, cls = "") {
  const el = h(`<div class="wheel-col ${cls}"><ul></ul></div>`);
  const ul = el.querySelector("ul");
  let list = [], idx = 0, timer = 0, silent = false;
  const paint = () => {
    ul.innerHTML = list.map((x, i) => `<li data-i="${i}" class="${i === idx ? "on" : ""}">${esc(x.label)}</li>`).join("");
  };
  const mark = i => { ul.querySelectorAll("li.on").forEach(li => li.classList.remove("on")); const li = ul.children[i]; if (li) li.classList.add("on"); };
  const jump = (i, smooth) => el.scrollTo({ top: i * ROW, behavior: smooth ? "smooth" : "auto" });
  const setItems = (items2, v) => {
    list = items2;
    const k = list.findIndex(x => x.v === v);
    idx = k >= 0 ? k : Math.min(idx, list.length - 1);
    paint(); silent = true; jump(idx, false); requestAnimationFrame(() => { silent = false; });
  };
  el.addEventListener("scroll", () => {
    const i = Math.max(0, Math.min(list.length - 1, Math.round(el.scrollTop / ROW)));
    if (i !== idx) { idx = i; mark(i); }
    clearTimeout(timer);
    timer = setTimeout(() => { if (!silent) onChange && onChange(list[idx].v); }, 120);
  }, { passive: true });
  ul.addEventListener("click", e => { const li = e.target.closest("li"); if (li) jump(+li.dataset.i, true); });
  setItems(items, value);
  requestAnimationFrame(() => jump(idx, false));           // 第一次放进页面后再对一次位置
  return { el, get: () => list[idx] && list[idx].v, set: v => setItems(list, v), setItems };
}

// 几列拼在一起，中间一条选中带
export function wheels(cols) {
  const el = h(`<div class="wheels"><div class="wheel-band"></div></div>`);
  cols.forEach(c => el.appendChild(c.el));
  return el;
}
export const visibleRows = SIDE * 2 + 1;
