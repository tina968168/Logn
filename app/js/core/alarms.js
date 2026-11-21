// 算响铃：Reminders 和 Days 的每一次（含提前几天的），一起交给手机。任何一个变了就重算。
import * as db from "./db.js";
import * as T from "./time.js";
import { setAlarms } from "./native.js";

const AHEAD = 400;        // 只排四百天内的
const PER_ITEM = 12;      // 每条最多排几次（每天重复的不至于把名额占满）
const MAX = 400;

const at = (date, time) => { const [y, m, d] = T.parts(date); const [hh, mm] = (time || "09:00").split(":").map(Number); return new Date(y, m - 1, d, hh, mm).getTime(); };
const lead = e => e === 0 ? "" : T.earlyShort(e) + " to go · ";

export function ruleOf(x) { return { repeat: x.repeat || "none", start: x.date, anchor: x.anchor, byWeekday: !!x.byWeekday, lunar: x.lunar }; }

export async function compute() {
  const now = Date.now(), from = T.today(), until = T.addDays(from, AHEAD);
  const out = [];
  for (const r of await db.all("reminders")) {
    if (r.done) continue;
    const rule = { ...ruleOf(r), start: r.date };       // 重复的提醒，date 就是下一次
    let n = 0;
    for (const day of T.upcoming(rule, r.date, PER_ITEM)) {
      if (day > until) break;
      for (const e of (r.early && r.early.length ? r.early : [0])) {
        const t = at(T.addDays(day, -e), r.time);
        if (t > now && n < PER_ITEM) { out.push({ key: `r:${r.id}:${day}:${e}`, at: t, title: e ? "Coming up" : "Reminder", body: lead(e) + r.text, route: "reminders/" + r.id }); n++; }
      }
    }
  }
  for (const d of await db.all("days")) {
    if (!d.early || !d.early.length) continue;
    const rule = ruleOf(d);
    for (const day of T.upcoming(rule, from, 3)) {
      if (day > until) break;
      for (const e of d.early) {
        const t = at(T.addDays(day, -e), "09:00");
        if (t > now) out.push({ key: `d:${d.id}:${day}:${e}`, at: t, title: e ? "Coming up" : "Today", body: lead(e) + d.name, route: "days/" + d.id });
      }
    }
  }
  out.sort((a, b) => a.at - b.at);
  return out.slice(0, MAX);
}
let timer = 0;
export function schedule() { clearTimeout(timer); timer = setTimeout(async () => setAlarms(await compute()), 300); }
