// Days：纪念日、生日、节日。顶上最近的一个，下面按远近分组，右边还有几天
import * as db from "../core/db.js";
import * as T from "../core/time.js";
import { on } from "../core/bus.js";
import { makeSelect } from "../core/select.js";
import { h, esc, toast } from "../core/ui.js";
import { detailSheet, editSheet } from "../core/card.js";
import { textField, whenField, repeatField, earlyField } from "../core/fields.js";
import { ruleOf } from "../core/alarms.js";

const ROOM = "days";
let el, sc, list = [];
const sel = makeSelect("days", ROOM, "day", () => paint());

// 下一次是哪天：重复的往后找，不重复的就是那天（可能已经过了）
const nextOf = (d, day) => T.nextOn(ruleOf(d), day);
const repeatShort = d => ({ none: "", month: "Every month", year: "Every year", lunar: T.lunarName(d.date) }[d.repeat || "none"]);
const away = n => n === 0 ? "Today" : n === 1 ? "Tomorrow" : n > 0 ? n + " days" : -n + (n === -1 ? " day ago" : " days ago");
const tone = n => n < 0 ? "var(--ink-3)" : n <= 7 ? "var(--ink)" : n <= 60 ? "var(--ink-2)" : "var(--ink-3)";   // 越近越深
const groupOf = (next, n, day) => n < 0 ? "Past" : n === 0 ? "Today" : next.slice(0, 7) === day.slice(0, 7) ? "This month" : n <= 92 ? "Next 3 months" : "Later";
const GROUPS = ["Today", "This month", "Next 3 months", "Later", "Past"];

export const page = {
  id: "days", name: "Days",
  icon: `<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/>`,
  action: { label: "New day", run: () => edit(null) },
  mount(node) {
    el = node;
    el.appendChild(h(`<div class="scroll" id="dyScroll"></div>`));
    sc = el.querySelector("#dyScroll");
    sc.onclick = onClick;
    on("change", e => { if (e.room === ROOM) load(); });
    load();
  },
  refresh: () => load(),
  select: sel,
  async count() { const day = T.today(); return (await db.all(ROOM)).filter(d => nextOf(d, day) === day).length; },
  async open(id) { const d = await db.get(ROOM, id); if (d) detail(d); },
};

async function load() { list = await db.all(ROOM); paint(); }

function row(x) {
  const bits = [T.wheelDay(x.next) + (x.next.slice(0, 4) !== T.today().slice(0, 4) ? ", " + x.next.slice(0, 4) : ""), repeatShort(x.d), x.d.by === "ke" ? "From Ke" : ""].filter(Boolean);
  return `<div class="lrow${sel.rowClass(x.d.id)}" data-id="${x.d.id}">
    <div class="lrow-text"><div class="t">${esc(x.d.name)}</div><div class="s">${bits.map(esc).join(" · ")}</div></div>
    <span class="lrow-end" style="color:${tone(x.n)}">${esc(away(x.n))}</span>
    ${sel.mark(x.d.id)}
  </div>`;
}

function paint() {
  const day = T.today();
  const xs = list.map(d => { const next = nextOf(d, day); return { d, next, n: T.diff(day, next) }; })
    .sort((a, b) => a.n < 0 && b.n < 0 ? b.n - a.n : a.n < 0 ? 1 : b.n < 0 ? -1 : a.n - b.n);   // 往后的由近到远，过去的放最后、近的在前
  let html = "";
  if (!xs.length) html = `<div class="empty"><span class="script">Nothing yet.</span></div>`;
  else {
    const ahead = xs.filter(x => x.n >= 0);
    let big = "Nothing coming up";
    if (ahead.length) {
      const n = ahead[0].n, names = ahead.filter(x => x.n === n).map(x => x.d.name).join("、");
      big = n === 0 ? "Today is " + names : n === 1 ? "Tomorrow is " + names : n + " days to " + names;
    }
    html += `<div class="page-top"><span class="label">Next up</span><b>${esc(big)}</b></div>`;
    for (const g of GROUPS) {
      const inG = xs.filter(x => groupOf(x.next, x.n, day) === g);
      if (inG.length) html += `<div class="sec"><span class="label">${g}</span></div><div class="box">${inG.map(row).join("")}</div>`;
    }
  }
  const top = sc.scrollTop;
  sel.paint(xs.map(x => x.d.id), sc);
  sc.innerHTML = html; sc.scrollTop = top;
}

function onClick(e) {
  if (sel.click(e)) return;            // 在选的时候，点行＝勾上／取消
  const o = e.target.closest("[data-id]");
  if (o) { const d = list.find(x => x.id === o.dataset.id); if (d) detail(d); }
}


function detail(d) {
  const day = T.today(), next = nextOf(d, day), n = T.diff(day, next);
  const since = d.repeat && d.repeat !== "none" && d.date < day;
  const nextText = T.fullDate(next) + (d.repeat === "lunar" ? " · " + T.lunarName(next) : "");
  detailSheet({
    text: d.name, note: d.note, onEdit: () => edit(d),
    rows: [
      [n < 0 ? "Was" : "Next", esc(nextText) + "<br>" + esc(away(n))],
      ["Repeat", esc(T.repeatWord(ruleOf(d)))],
      since ? ["Since", esc(T.fullDate(d.date)) + "<br>" + T.diff(d.date, day) + " days"] : null,
      ["Alerts", d.early && d.early.length ? d.early.map(e => esc(e === 0 ? "On the day" : T.earlyWord(e))).join("<br>") : "None"],
      ["Added by", d.by === "ke" ? "Ke" : "You"],
    ],
  });
}

// 新建／修改：日子选最早那天（生日选出生那天），重复决定以后每年／每月
function edit(d) {
  const isNew = !d;
  d = d || { name: "", note: "", date: T.today(), repeat: "year", early: [0, 1] };   // 默认提前一天＋当天
  const name = textField({ label: "Name", value: d.name, placeholder: "What day is it", rows: 1 });
  const note = textField({ label: "Note", value: d.note || "", placeholder: "Optional", rows: 1 });
  let rep = null;
  const w = whenField({ date: d.date, withTime: false, fromYear: 1950, onChange: () => rep && rep.refresh() });
  rep = repeatField({ value: d.repeat || "none", kinds: ["none", "month", "year", "lunar"], dateOf: () => w.date() });
  const early = earlyField({ value: d.early || [], label: "Remind me at 9:00 AM", zero: "On the day" });
  const values = () => ({ name: name.get(), note: note.get(), date: w.date(), repeat: rep.get(), early: early.get() });
  editSheet({
    isNew, newTitle: "New day", noun: "day",
    fields: [name, note, w, rep, early], values,
    async save() {
      const v = values();
      if (!v.name) { toast("Give it a name first"); return false; }
      await db.put(ROOM, { ...d, ...v, anchor: T.parts(v.date)[2], lunar: v.repeat === "lunar" ? T.lunarOf(v.date) : null, byWeekday: false });
    },
    remove: () => db.del(ROOM, d.id),
  });
}
