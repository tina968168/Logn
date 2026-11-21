// 日期：一律用手机自己的钟。存 "YYYY-MM-DD" 和 "HH:MM"，算天数时按日历日算，不受换时间那天影响。
import * as lunar from "./lunar.js";

const DAY = 86400000;
const pad = n => String(n).padStart(2, "0");
export const ymd = d => d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
export const parts = s => s.split("-").map(Number);
export const today = () => ymd(new Date());
const serial = s => { const [y, m, d] = parts(s); return Date.UTC(y, m - 1, d) / DAY; };
export const diff = (a, b) => serial(b) - serial(a);            // b 比 a 晚几天
export function addDays(s, n) { const [y, m, d] = parts(s); const t = new Date(Date.UTC(y, m - 1, d + n)); return t.getUTCFullYear() + "-" + pad(t.getUTCMonth() + 1) + "-" + pad(t.getUTCDate()); }
const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate();   // m 是 1–12
const make = (y, m, d) => y + "-" + pad(m) + "-" + pad(Math.min(d, lastDay(y, m)));
export const weekday = s => { const [y, m, d] = parts(s); return new Date(Date.UTC(y, m - 1, d)).getUTCDay(); };

// 「某月第几个星期几」：从一个日子推出来（3-14 是三月第二个星期日）
export const nthOf = s => Math.ceil(parts(s)[2] / 7);
function nthWeekday(y, m, nth, wd) {
  const first = weekday(make(y, m, 1));
  let d = 1 + ((wd - first + 7) % 7) + (nth - 1) * 7;
  if (d > lastDay(y, m)) d -= 7;                 // 第五个不存在就用最后一个
  return make(y, m, d);
}

// 重复的下一次：rule = {repeat, anchor（原始的日）, byWeekday, start（最早那天）, lunar:{m,d}}
// 返回 >= from 的第一次；不重复的直接返回 start
export function nextOn(rule, from) {
  const { repeat, start } = rule;
  if (!repeat || repeat === "none") return start;
  if (from <= start) return start;
  const [sy, sm, sd] = parts(start), anchor = rule.anchor || sd;
  if (repeat === "day") return from;
  if (repeat === "week") { const k = Math.ceil(diff(start, from) / 7); return addDays(start, k * 7); }
  if (repeat === "month") {
    const [fy, fm] = parts(from);
    for (let i = 0; i < 3; i++) {
      const y = fy + Math.floor((fm - 1 + i) / 12), m = ((fm - 1 + i) % 12) + 1;
      const c = rule.byWeekday ? nthWeekday(y, m, nthOf(start), weekday(start)) : make(y, m, anchor);
      if (c >= from) return c;
    }
  }
  if (repeat === "year") {
    const fy = parts(from)[0];
    for (let y = fy; y <= fy + 1; y++) {
      const c = rule.byWeekday ? nthWeekday(y, sm, nthOf(start), weekday(start)) : make(y, sm, anchor);
      if (c >= from) return c;
    }
  }
  if (repeat === "lunar") {
    const L = rule.lunar || lunar.fromSolar(start), fy = parts(from)[0];
    for (let y = fy - 1; y <= fy + 1; y++) {
      const c = lunar.toSolar(y, L.m, L.d);
      if (c && c >= from) return c;
    }
  }
  return start;
}
// 往后几次（排响铃用）
export function upcoming(rule, from, count) {
  const out = []; let f = from;
  for (let i = 0; i < count; i++) {
    const n = nextOn(rule, f);
    if (n < f || out.includes(n)) break;
    out.push(n);
    if (!rule.repeat || rule.repeat === "none") break;
    f = addDays(n, 1);
  }
  return out;
}

// ——— 显示（界面英文） ———
const WD = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WDS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MO = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MOL = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const ORD = n => n + (n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th");
export const ordinal = ORD;

export const monthDay = s => { const [, m, d] = parts(s); return MO[m - 1] + " " + d; };
export function fullDate(s) { const [y, m, d] = parts(s); return WD[weekday(s)] + ", " + MO[m - 1] + " " + d + (y !== parts(today())[0] ? ", " + y : ""); }
export const weekdayName = s => WD[weekday(s)];
export const wheelDay = s => WDS[weekday(s)] + ", " + monthDay(s);
export const monthShort = m => MO[m - 1];
// 按月分组的标题：这个月写 This month，别的写月份全名，不是今年的带上年份（Notes、Chat 的照片和文件）
export const monthWord = (ym, ref = today()) => ym === ref.slice(0, 7) ? "This month" : MOL[+ym.slice(5, 7) - 1] + (ym.slice(0, 4) !== ref.slice(0, 4) ? " " + ym.slice(0, 4) : "");
export const monthLong = s => { const [, m, d] = parts(s); return MOL[m - 1] + " " + d; };
// 列表里说哪天：Today、Tomorrow、Yesterday，一周内写星期几，再远写日期
export function dayWord(s, ref = today()) {
  const n = diff(ref, s);
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n === -1) return "Yesterday";
  if (n > 1 && n < 7) return WDS[weekday(s)];
  const [y] = parts(s);
  return monthDay(s) + (y !== parts(ref)[0] ? ", " + y : "");
}
// 还有几天
export function inWords(s, ref = today()) {
  const n = diff(ref, s);
  if (n === 0) return "Today";
  if (n === 1) return "Tomorrow";
  if (n === -1) return "Yesterday";
  return n > 0 ? "In " + n + " days" : n * -1 + " days ago";
}
export function earlyWord(e) {
  if (e === 0) return "On time";
  if (e % 30 === 0) return e === 30 ? "1 month before" : e / 30 + " months before";
  if (e % 7 === 0) return e === 7 ? "1 week before" : e / 7 + " weeks before";
  return e === 1 ? "1 day before" : e + " days before";
}
export function earlyShort(e) {
  if (e === 0) return "On time";
  if (e % 30 === 0) return e / 30 + (e === 30 ? " month" : " months");
  if (e % 7 === 0) return e / 7 + (e === 7 ? " week" : " weeks");
  return e + (e === 1 ? " day" : " days");
}
export function repeatWord(rule) {
  const { repeat, start } = rule;
  if (!repeat || repeat === "none") return "Once";
  if (repeat === "day") return "Every day";
  if (repeat === "week") return "Every " + WD[weekday(start)];
  const [, m, d] = parts(start);
  if (repeat === "month") return rule.byWeekday ? "Every month, " + ORD(nthOf(start)) + " " + WD[weekday(start)] : "Every month on the " + ORD(rule.anchor || d);
  if (repeat === "year") return rule.byWeekday ? "Every year, " + ORD(nthOf(start)) + " " + WD[weekday(start)] + " of " + MOL[m - 1] : "Every year on " + MO[m - 1] + " " + (rule.anchor || d);
  if (repeat === "lunar") { const L = rule.lunar || lunar.fromSolar(start); return "Every year on " + lunar.name(L.m, L.d); }
  return "";
}
export const lunarName = s => { const L = lunar.fromSolar(s); return lunar.name(L.m, L.d); };
export const lunarOf = s => { const L = lunar.fromSolar(s); return { m: L.m, d: L.d }; };
export const nowHM = () => { const d = new Date(); return pad(d.getHours()) + ":" + pad(d.getMinutes()); };
// 显示时间一律 12 小时制："14:05" → "2:05 PM"；存的还是 "HH:MM"
export const clock = hhmm => { const [h, m] = hhmm.split(":").map(Number); return (h % 12 || 12) + ":" + pad(m) + (h < 12 ? " AM" : " PM"); };
export const clockOf = ts => { const d = new Date(ts); return clock(pad(d.getHours()) + ":" + pad(d.getMinutes())); };
