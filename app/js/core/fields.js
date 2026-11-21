// 表单件：几页共用（写的字、日子和时间的滚轮、重复、提前几天）
import { h, esc } from "./ui.js";
import * as T from "./time.js";
import { column, wheels } from "./wheel.js";
import { iconWith } from "./icons.js";

const pad = n => String(n).padStart(2, "0");
const TICK = iconWith("tick", "tick");

// 写字；max：框最高长到多少，再多就在框里滚
export function textField({ label, value = "", placeholder = "", rows = 2, max = 200 }) {
  const el = h(`<div class="field"><span class="label">${esc(label)}</span><textarea rows="${rows}" placeholder="${esc(placeholder)}"></textarea></div>`);
  const ta = el.querySelector("textarea"); ta.value = value;
  const fit = () => { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, max) + "px"; };
  ta.addEventListener("input", fit); requestAnimationFrame(fit);
  return { el, get: () => ta.value.trim() };
}

// 日子和时间：左年份、中月日、右时间（最上一格 All day＝当天 9:00 AM 响）。上下滑。
// fromYear：最早能选到哪年（Days 要选过去的日子）
export function whenField({ date, time = "", withTime = true, fromYear, onChange }) {
  const now = T.parts(T.today())[0];
  let [y, m, d] = T.parts(date || T.today());
  const y0 = Math.min(fromYear || now - 1, y), y1 = Math.max(now + 10, y);
  const el = h(`<div class="field"><span class="label">When</span><div class="when-sum"></div></div>`);
  const sum = el.querySelector(".when-sum");

  const years = []; for (let k = y1; k >= y0; k--) years.push({ v: k, label: String(k) });
  years.reverse();
  const daysOf = yy => { const out = []; for (let mm = 1; mm <= 12; mm++) { const n = new Date(Date.UTC(yy, mm, 0)).getUTCDate(); for (let dd = 1; dd <= n; dd++) { const s = `${yy}-${pad(mm)}-${pad(dd)}`; out.push({ v: `${pad(mm)}-${pad(dd)}`, label: T.wheelDay(s) }); } } return out; };
  const times = [{ v: "", label: "All day" }];
  for (let hh = 0; hh < 24; hh++) for (let mm = 0; mm < 60; mm += 5) times.push({ v: `${pad(hh)}:${pad(mm)}`, label: T.clock(`${pad(hh)}:${pad(mm)}`) });
  if (time && !times.some(t => t.v === time)) { times.push({ v: time, label: T.clock(time) }); times.sort((a, b) => a.v < b.v ? -1 : 1); }

  const value = () => `${yc.get()}-${mc.get()}`;
  const paintSum = () => {
    const s = value(), t = withTime ? tc.get() : "";
    sum.textContent = T.fullDate(s) + (withTime ? " · " + (t ? T.clock(t) : "All day, rings at 9:00 AM") : "");
    onChange && onChange(s);
  };
  const yc = column(years, y, yy => { const md = mc.get(); const [mm, dd] = md.split("-").map(Number); const fit = Math.min(dd, new Date(Date.UTC(yy, mm, 0)).getUTCDate()); mc.setItems(daysOf(yy), `${pad(mm)}-${pad(fit)}`); paintSum(); }, "wy");
  const mc = column(daysOf(y), `${pad(m)}-${pad(d)}`, paintSum, "wd");
  const cols = [yc, mc];
  let tc = null;
  if (withTime) { tc = column(times, time, paintSum, "wt"); cols.push(tc); }
  el.appendChild(wheels(cols));
  paintSum();
  return { el, date: value, time: () => (withTime ? tc.get() : "") };
}

// 一组可点的行，选中的打勾。multi：可以多选
function optionRows(el, opts, picked, multi, after) {
  const box = el.querySelector(".opts");
  box.innerHTML = opts.map(o => `<button type="button" class="opt${picked.has(o.v) ? " on" : ""}" data-v="${esc(o.v)}"><span>${esc(o.label)}</span>${TICK}</button>`).join("");
  box.onclick = e => {
    const b = e.target.closest(".opt"); if (!b) return;
    const v = opts.find(o => String(o.v) === b.dataset.v).v;
    if (multi) { picked.has(v) ? picked.delete(v) : picked.add(v); }
    else { picked.clear(); picked.add(v); }
    after();
  };
}

// 重复：一行一句白话
// kinds：这页能用哪几种（Reminders：none day week month year；Days：none month year lunar）
export function repeatField({ value = "none", byWeekday = false, kinds, dateOf }) {
  const el = h(`<div class="field"><span class="label">Repeat</span><div class="opts"></div></div>`);
  const picked = new Set([value]);
  const keepRule = byWeekday && value === "year";       // 我加的夏令时那种，只在没改成别的时保留
  const paint = () => {
    const s = dateOf();
    const label = v => {
      if (v === "year" && keepRule) return T.repeatWord({ repeat: "year", start: s, byWeekday: true });
      return { none: "Never", day: "Every day", week: "Every week on " + T.weekdayName(s), month: "Every month on the " + T.ordinal(T.parts(s)[2]), year: "Every year on " + T.monthDay(s), lunar: "Every year on " + T.lunarName(s) + " (lunar)" }[v];
    };
    optionRows(el, kinds.map(v => ({ v, label: label(v) })), picked, false, paint);
  };
  paint();
  const get = () => [...picked][0];
  return { el, get, byWeekday: () => keepRule && get() === "year", refresh: paint };
}

// 提前几天：可以多选；常用的直接点，Custom… 打开小滚轮自己选几天
const PRESET = [0, 1, 3, 7, 30];
export function earlyField({ value = [0], label = "Remind me", zero = "At the time" }) {
  const picked = new Set(value);
  const el = h(`<div class="field"><span class="label">${esc(label)}</span><div class="opts"></div>
    <button type="button" class="opt custom-open"><span>Custom…</span></button>
    <div class="custom" hidden><div class="custom-wheel"></div><button type="button" class="pill dark custom-add">Add</button></div></div>`);
  const custom = el.querySelector(".custom"), opener = el.querySelector(".custom-open");
  const days = []; for (let k = 1; k <= 365; k++) days.push({ v: k, label: T.earlyWord(k) });
  let wc = null;
  const paint = () => {
    const all = [...new Set([...PRESET, ...picked])].sort((a, b) => a - b);
    optionRows(el, all.map(v => ({ v, label: v === 0 ? zero : T.earlyWord(v) })), picked, true, paint);
  };
  opener.onclick = () => {
    custom.hidden = !custom.hidden;
    if (!custom.hidden && !wc) { wc = column(days, 2, null); el.querySelector(".custom-wheel").appendChild(wheels([wc])); }
  };
  el.querySelector(".custom-add").onclick = () => { picked.add(wc.get()); custom.hidden = true; paint(); };
  paint();
  return { el, get: () => [...picked].sort((a, b) => b - a) };
}
