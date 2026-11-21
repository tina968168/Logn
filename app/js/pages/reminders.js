// Reminders：打开 app 先看到的那页
import * as db from "../core/db.js";
import * as T from "../core/time.js";
import { on } from "../core/bus.js";
import { makeSelect } from "../core/select.js";
import { h, esc, toast, confirm } from "../core/ui.js";
import { I } from "../core/icons.js";
import { detailSheet, editSheet } from "../core/card.js";
import { textField, whenField, repeatField, earlyField } from "../core/fields.js";
import { ruleOf } from "../core/alarms.js";
import { haptic } from "../core/native.js";

const ROOM = "reminders";
let el, sc, list = [], tab = "todo";        // 顶上两类：To do／Done
const sel = makeSelect("reminders", ROOM, "reminder", () => paint());

const when = r => r.date + " " + (r.time || "09:00");
const timeText = r => r.time ? T.clock(r.time) : "All day";
const repeats = r => r.repeat && r.repeat !== "none";
const alertsOf = r => r.early && r.early.length ? r.early : [0];
const SHORT = { none: "", day: "Daily", week: "Weekly", month: "Monthly", year: "Yearly" };

export const page = {
  id: "reminders", name: "Reminders",
  icon: `<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0"/>`,
  action: { label: "New reminder", run: () => edit(null) },
  mount(node) {
    el = node;
    el.appendChild(h(`<div class="scroll rm-page" id="rmScroll"></div>`));
    sc = el.querySelector("#rmScroll");
    sc.onclick = onClick;
    on("change", e => { if (e.room === ROOM) load(); });
    load();
  },
  refresh: () => load(),
  select: sel,
  async count() { const day = T.today(); return (await db.all(ROOM)).filter(r => !r.done && r.date <= day).length; },   // 今天或更早还没做
  async open(id) { const r = await db.get(ROOM, id); if (r) detail(r); },
};

async function load() { list = await db.all(ROOM); paint(); }

// 一行：左边圆圈（点了就是做完），中间写的字和一行小字，右边时间
function row(r, day) {
  const late = !r.done && r.date < day;
  const bits = [
    late ? "Late · " + T.dayWord(r.date, day) : "",
    SHORT[r.repeat || "none"],
    alertsOf(r).length > 1 ? alertsOf(r).length + " alerts" : "",
    r.by === "ke" ? "From Ke" : "",
  ].filter(Boolean);
  return `<div class="lrow rm-row${r.done ? " done" : ""}${sel.rowClass(r.id)}" data-id="${r.id}">
    <button class="check${r.done ? " on" : ""}" data-check="${r.id}" aria-label="${r.done ? "Mark as not done" : "Mark as done"}"><i>${I.tick}</i></button>
    <div class="lrow-text"><div class="t">${esc(r.text)}</div>${bits.length ? `<div class="s">${bits.map(esc).join(" · ")}</div>` : ""}</div>
    <span class="lrow-end">${esc(timeText(r))}</span>
    ${sel.mark(r.id)}
  </div>`;
}
// 按天分组，组名跟别的页一样说：Today、Tomorrow、一周内写星期几，再远写日期
const groups = (items, keyOf, day) => [...new Set(items.map(keyOf))].map(d =>
  `<div class="sec"><span class="label">${esc(T.dayWord(d, day))}</span></div><div class="box">${items.filter(r => keyOf(r) === d).map(r => row(r, day)).join("")}</div>`).join("");

function paint() {
  const day = T.today();
  const open = list.filter(r => !r.done).sort((a, b) => when(a) < when(b) ? -1 : 1);
  const done = list.filter(r => r.done).sort((a, b) => b.date < a.date ? -1 : b.date > a.date ? 1 : (b.doneAt || 0) - (a.doneAt || 0));
  const shown = tab === "todo" ? open : done;
  let html = `<div class="page-top"><span class="label">${esc(T.weekdayName(day))}</span><b>${esc(T.monthLong(day))}</b></div>
    <div class="tabs"><button data-tab="todo" class="${tab === "todo" ? "on" : ""}">To do${open.length ? " · " + open.length : ""}</button><button data-tab="done" class="${tab === "done" ? "on" : ""}">Done${done.length ? " · " + done.length : ""}</button></div>`;
  if (!shown.length) html += `<div class="empty"><span class="script">Nothing yet.</span></div>`;
  else if (tab === "todo") html += groups(open, r => (r.date < day ? day : r.date), day);      // 过期没做的归到今天
  else html += groups(done, r => r.date, day);
  const top = sc.scrollTop;
  sel.paint(shown.map(r => r.id), sc);
  sc.innerHTML = html; sc.scrollTop = top;
}

function onClick(e) {
  if (sel.click(e)) return;            // 在选的时候，点行＝勾上／取消
  const c = e.target.closest("[data-check]");
  if (c) { askToggle(c.dataset.check); return; }
  const tb = e.target.closest("[data-tab]");
  if (tb) { tab = tb.dataset.tab; sc.scrollTop = 0; paint(); return; }
  const o = e.target.closest("[data-id]");
  if (o) { const r = list.find(x => x.id === o.dataset.id); if (r) detail(r); }
}

// 勾、取消勾一律先问一句：列表上的圆圈、详情里的按钮都一样
async function askToggle(id) {
  const r = list.find(x => x.id === id); if (!r) return;
  const q = r.done ? `Mark “${r.text}” as not done?` : repeats(r) ? `Done for this time? “${r.text}”` : `Mark “${r.text}” as done?`;
  if (await confirm(q, r.done ? "Not done" : "Done")) await toggle(id);
}
// 勾掉：不重复的进 Done；重复的跳到今天以后的下一次
async function toggle(id) {
  const r = await db.get(ROOM, id); if (!r) return;
  haptic();
  if (r.done) { await db.put(ROOM, { ...r, done: false, doneAt: null }); return; }
  if (repeats(r)) {
    const after = T.addDays(r.date > T.today() ? r.date : T.today(), 1);
    const nextDay = T.nextOn(ruleOf(r), after);
    await db.put(ROOM, { ...r, date: nextDay, lastDone: Date.now() });
    toast("Next: " + T.dayWord(nextDay));
  } else {
    await db.put(ROOM, { ...r, done: true, doneAt: Date.now() });
  }
}

function detail(r) {
  const button = h(`<button class="pill dark detail-do">${r.done ? "Mark as not done" : repeats(r) ? "Done for this time" : "Mark as done"}</button>`);
  const s = detailSheet({
    text: r.text, note: r.note, button, onEdit: () => edit(r),
    rows: [
      ["When", esc(T.fullDate(r.date)) + " · " + esc(timeText(r))],
      ["Repeat", esc(T.repeatWord(ruleOf(r)))],
      ["Alerts", alertsOf(r).map(e => esc(T.earlyWord(e))).join("<br>")],
      ["Added by", r.by === "ke" ? "Ke" : "You"],
    ],
  });
  button.onclick = async () => { s.close(); await askToggle(r.id); };
}

function edit(r) {
  const isNew = !r;
  r = r || { text: "", note: "", date: T.today(), time: "", repeat: "none", early: [0, 1] };   // 默认提前一天＋当天
  const text = textField({ label: "Reminder", value: r.text, placeholder: "What to remember", rows: 2 });
  const note = textField({ label: "Note", value: r.note || "", placeholder: "Optional", rows: 1 });
  let rep = null;
  const w = whenField({ date: r.date, time: r.time, onChange: () => rep && rep.refresh() });
  rep = repeatField({ value: r.repeat, byWeekday: r.byWeekday, kinds: ["none", "day", "week", "month", "year"], dateOf: () => w.date() });
  const early = earlyField({ value: alertsOf(r) });
  const values = () => ({ text: text.get(), note: note.get(), date: w.date(), time: w.time(), repeat: rep.get(), byWeekday: rep.byWeekday(), early: early.get() });
  editSheet({
    isNew, newTitle: "New reminder", noun: "reminder",
    fields: [text, note, w, rep, early], values,
    async save() {
      const v = values();
      if (!v.text) { toast("Write something first"); return false; }
      const anchor = r.anchor && r.date === v.date ? r.anchor : T.parts(v.date)[2];
      await db.put(ROOM, { ...r, ...v, anchor });
    },
    remove: () => db.del(ROOM, r.id),
  });
}
