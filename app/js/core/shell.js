// 外壳：换页、顶栏、侧栏、数字、深浅
import * as db from "./db.js";
import { on } from "./bus.js";
import { pushLayer, back as backLayer, esc } from "./ui.js";
import { I } from "./icons.js";
import { bars } from "./native.js";

const $ = id => document.getElementById(id);
const pages = [];          // 页面模块，按侧栏顺序
let cur = null, closeLayer = null;

export function register(p) { pages.push(p); }
export const current = () => cur;

// 换页
export function go(id, item) {
  const p = pages.find(x => x.id === id) || pages[0];
  if (cur !== p) {
    document.querySelectorAll(".page").forEach(el => el.classList.toggle("on", el.dataset.page === p.id));
    cur = p;
    $("app").dataset.page = p.id;           // 页自己的样子（Chat）靠它
    retitle();
    if (cur && cur.select && cur.select.on) cur.select.set(false);      // 换页就退出上一页的选择
    if (p.action) { $("actionBtn").setAttribute("aria-label", p.action.label); $("actionBtn").innerHTML = p.action.icon || I.plus; }
    if (p.extra) { $("extraBtn").setAttribute("aria-label", p.extra.label); $("extraBtn").innerHTML = p.extra.icon; }
    paintSelect();
    paintDrawer();
    if (p.shown) p.shown();
    paintBars();
  }
  closeDrawer();
  if (item && p.open) p.open(item);
}
// 顶栏标题：页有 title() 就用它画（Chat 带头像），没有就写页名
export function retitle() { if (cur) $("pageTitle").innerHTML = cur.title ? cur.title() : esc(cur.name); }
// 通知点进来："reminders/abc"
export function route(r) { const [id, item] = r.split("/"); go(id, item); }

// 顶栏右边按钮：平时垃圾桶（页里有东西才有；trash:false 的页不要，Chat 从长按进选择）、第二个按钮（页有 extra 才有，Chat 的 Clawd：叫克来看）和 +；点垃圾桶进选择，换成全选、删（带数字）、× 退出
const selState = {};          // 页 id → {can, on, n, all}，页自己报
function paintSelect() {
  const s = (cur && selState[cur.id]) || {}, has = !!(cur && cur.select), on = has && !!s.on;
  $("selectBtn").hidden = on || !(has && s.can) || cur.trash === false;
  $("actionBtn").hidden = on || !(cur && cur.action);
  $("extraBtn").hidden = on || !(cur && cur.extra);
  ["selectAllBtn", "deleteBtn", "cancelBtn"].forEach(k => { $(k).hidden = !on; });
  $("selectBadge").hidden = !s.n; $("selectBadge").textContent = s.n || "";
  $("selectAllBtn").classList.toggle("on", !!s.all);
}
on("selecting", s => { selState[s.id] = s; paintSelect(); });

// 侧栏
function paintDrawer() {
  $("drawerList").innerHTML = pages.map(p => `
    <button class="drawer-item${p === cur ? " on" : ""}" data-id="${p.id}">
      <svg viewBox="0 0 24 24">${p.icon}</svg><span>${p.name}</span>
      <i class="count" data-count="${p.id}" hidden></i>
    </button>`).join("");
  paintCounts();
}
export function openDrawer() {
  if ($("app").classList.contains("drawer-open")) return;
  $("app").classList.add("drawer-open");
  closeLayer = pushLayer(closeDrawer);
}
export function closeDrawer() {
  if (!$("app").classList.contains("drawer-open")) return;
  $("app").classList.remove("drawer-open");
  if (closeLayer) { closeLayer(); closeLayer = null; }
}

// 数字：每页自己数，左上是加起来
let counts = {};
async function paintCounts() {
  let total = 0;
  for (const p of pages) {
    const n = p.count ? await p.count() : 0;
    counts[p.id] = n; total += n;
  }
  document.querySelectorAll("[data-count]").forEach(el => { const n = counts[el.dataset.count] || 0; el.hidden = !n; el.textContent = n > 99 ? "99+" : n; });
  const b = $("menuBadge"); b.hidden = !total; b.textContent = total > 99 ? "99+" : total;
}
let countTimer = 0;
export const recount = () => { clearTimeout(countTimer); countTimer = setTimeout(paintCounts, 50); };

// 深浅：light / dark / auto（跟手机）
const mq = window.matchMedia("(prefers-color-scheme: dark)");
let themePref = "auto";
function applyTheme() {
  const dark = themePref === "dark" || (themePref === "auto" && mq.matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.querySelectorAll("#themeSeg button").forEach(b => b.classList.toggle("on", b.dataset.v === themePref));
  paintBars();
}
// 手机系统栏用顶栏的颜色（顶栏透明就用页面底色）
function paintBars() {
  requestAnimationFrame(() => {
    let c = getComputedStyle(document.querySelector(".bar")).backgroundColor;
    if (c === "transparent" || /,\s*0\)$/.test(c)) c = getComputedStyle($("app")).backgroundColor;
    bars(c, document.documentElement.dataset.theme === "dark");
  });
}

// 手势：屏幕左边缘往右划打开；侧栏开着时往左划收起
function gestures() {
  let x0 = null, y0 = 0, fromEdge = false;
  const app = $("app");
  app.addEventListener("touchstart", e => {
    const t = e.touches[0]; x0 = t.clientX; y0 = t.clientY;
    fromEdge = x0 < 24 && !app.classList.contains("drawer-open");
  }, { passive: true });
  app.addEventListener("touchend", e => {
    if (x0 === null) return;
    const t = e.changedTouches[0], dx = t.clientX - x0, dy = Math.abs(t.clientY - y0);
    if (fromEdge && dx > 50 && dy < 60) openDrawer();
    else if (app.classList.contains("drawer-open") && dx < -50 && dy < 60) closeDrawer();
    x0 = null;
  }, { passive: true });
}

export async function start(first) {
  document.querySelectorAll("i[data-icon]").forEach(x => { x.outerHTML = I[x.dataset.icon]; });   // 顶栏的图标
  themePref = await db.getMeta("theme", "auto");
  applyTheme();
  mq.addEventListener("change", applyTheme);
  $("themeSeg").onclick = async e => { const b = e.target.closest("button"); if (!b) return; themePref = b.dataset.v; applyTheme(); await db.setMeta("theme", themePref); };
  $("menuBtn").onclick = openDrawer;
  $("veil").onclick = closeDrawer;
  $("drawerList").onclick = e => { const b = e.target.closest("[data-id]"); if (b) go(b.dataset.id); };
  $("selectBtn").onclick = () => cur && cur.select && cur.select.set(true);
  $("deleteBtn").onclick = () => cur && cur.select && cur.select.del();
  $("selectAllBtn").onclick = () => cur && cur.select && cur.select.all();
  $("cancelBtn").onclick = () => cur && cur.select && cur.select.set(false);
  $("actionBtn").onclick = () => cur && cur.action && cur.action.run();
  $("extraBtn").onclick = () => cur && cur.extra && cur.extra.run();
  pages.forEach(p => p.mount(document.getElementById("page-" + p.id)));
  gestures();
  go(first);
  on("change", recount);
  on("meta", recount);
  // 过了零点：日期变了，各页重画、数字重算
  let day = new Date().toDateString();
  setInterval(() => { const d = new Date().toDateString(); if (d !== day) { day = d; pages.forEach(p => p.refresh && p.refresh()); recount(); } }, 30000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { pages.forEach(p => p.refresh && p.refresh()); recount(); } });
}
export const back = () => backLayer();
