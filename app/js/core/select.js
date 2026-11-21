// 选了再删：点顶栏垃圾桶进来，点一条勾一条；顶栏左边全选，垃圾桶确认删除，× 或返回键退出
import * as db from "./db.js";
import { emit } from "./bus.js";
import { confirm, toast, pushLayer } from "./ui.js";
import { I } from "./icons.js";

// id：页 id；room：仓库；noun：确认框里叫什么；repaint：重画这页
// also(ids)：删这几条时别的仓库里要一起删的，返回 [{room, ids}]（笔记的图）
export function makeSelect(id, room, noun, repaint, { also } = {}) {
  const s = { on: false, picked: new Set(), ids: [] };
  let closeLayer = null;
  s.set = v => {
    s.on = v; s.picked.clear();
    if (v && !closeLayer) closeLayer = pushLayer(() => { closeLayer = null; s.set(false); });
    if (!v && closeLayer) { const c = closeLayer; closeLayer = null; c(); }
    repaint();
  };
  // 画页时调：ids＝这页现在能选的；顶栏按钮跟着它报的状态变
  s.paint = (ids, scroll) => {
    s.ids = ids;
    if (!ids.length && s.on) { s.on = false; if (closeLayer) { const c = closeLayer; closeLayer = null; c(); } }
    [...s.picked].forEach(x => { if (!ids.includes(x)) s.picked.delete(x); });
    emit("selecting", { id, can: ids.length > 0, on: s.on, n: s.picked.size, all: s.on && s.picked.size === ids.length });
    scroll.classList.toggle("selecting", s.on);
  };
  // 每行右边的圈（不在选时不出）
  s.mark = rid => s.on ? `<i class="pick${s.picked.has(rid) ? " on" : ""}">${I.tick}</i>` : "";
  s.rowClass = rid => s.on && s.picked.has(rid) ? " picked" : "";
  // 在选时点行＝勾上／取消，返回 true；别的点击照常
  s.click = e => {
    if (!s.on) return false;
    const row = e.target.closest("[data-id]");
    if (!row) return false;
    s.picked.has(row.dataset.id) ? s.picked.delete(row.dataset.id) : s.picked.add(row.dataset.id);
    repaint(); return true;
  };
  s.all = () => { if (s.picked.size === s.ids.length) s.picked.clear(); else s.ids.forEach(x => s.picked.add(x)); repaint(); };
  s.del = async () => {
    const ids = [...s.picked], n = ids.length; if (!n) return;
    if (!(await confirm(`Delete ${n} ${noun}${n === 1 ? "" : "s"}? This can't be undone.`, "Delete", true))) return;
    const extra = also ? also(ids) : [];   // 先记下挂着的，删完这页就查不到了
    s.set(false);
    await db.delMany(room, ids);          // 手机和服务器一起删
    for (const x of extra) if (x.ids.length) await db.delMany(x.room, x.ids);
    toast("Deleted");
  };
  return s;
}
