// 一条东西的两张卡，Reminders、Days、Notes 共用：
// 详情：点开先看，左上 Close、右上 Edit；新建／修改：左上 Cancel、右上 Add 或 Save，改的时候最下面单独一个 Delete
import { h, esc, sheet, confirm, toast } from "./ui.js";

// text 大字，note 小字（空就不出）；extra 放在大字卡下面（Notes 的图）；rows = [[标签, 已转义的 html]]，null 跳过；button 放最下面
export function detailSheet({ text, note, extra, rows, button, onEdit }) {
  const body = h(`<div class="detail">
    <div class="card detail-main"><div class="detail-text"></div>${note ? `<div class="detail-note"></div>` : ""}</div>
    <div class="list">${rows.filter(Boolean).map(([k, v]) => `<div class="item"><span class="label">${esc(k)}</span><span class="detail-v">${v}</span></div>`).join("")}</div>
  </div>`);
  body.querySelector(".detail-text").textContent = text;
  if (note) body.querySelector(".detail-note").textContent = note;
  if (extra) body.querySelector(".detail-main").after(extra);
  if (button) body.appendChild(button);
  return sheet({ title: "", left: { label: "Close", run: s => s.close() }, right: { label: "Edit", run: () => onEdit() }, body });
}

// fields：表单件（{el} 或元素），按顺序放；values()：现在填的，跟打开时不一样就算改过，关之前问一句 Discard
// save()：存，返回 false＝没存（缺东西，自己提示）；remove()：删（已经确认过）；leave()：卡片关掉时收尾，只调一次
export function editSheet({ isNew, newTitle, noun, fields, values, save, remove, leave = () => {} }) {
  const body = document.createDocumentFragment();
  fields.forEach(f => body.appendChild(f.el || f));
  const foot = isNew ? null : h(`<button class="link red">Delete ${esc(noun)}</button>`);
  const first = JSON.stringify(values());
  let done = false;
  const finish = (s, msg) => { done = true; leave(); s.close(); toast(msg); };
  const s = sheet({
    title: isNew ? newTitle : "Edit",
    left: { label: "Cancel", run: s => s.close() },
    right: { label: isNew ? "Add" : "Save", run: async s => { if (await save() !== false) finish(s, isNew ? "Added" : "Saved"); } },
    body, foot,
    guard: async () => {
      if (done) return true;
      if (JSON.stringify(values()) !== first && !(await confirm(isNew ? `Discard this ${noun}?` : "Discard changes?", "Discard", true))) return false;
      done = true; leave(); return true;
    },
  });
  if (foot) foot.onclick = async () => { if (await confirm(`Delete this ${noun}?`, "Delete", true)) { await remove(); finish(s, "Deleted"); } };
  return s;
}
