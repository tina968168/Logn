// 画聊天：一行一条，一组第一句带头像，每句旁边写几点，换天中间出一行 Today／Yesterday／日子
import * as db from "../../core/db.js";
import * as T from "../../core/time.js";
import * as M from "../../core/media.js";
import { esc, toast } from "../../core/ui.js";
import { makeSelect } from "../../core/select.js";
import { current, retitle } from "../../core/shell.js";
import { S, ROOM, mediaOf } from "./state.js";
import { avatar, body } from "./bubble.js";
import { paintAudio } from "./audio.js";
import { isTyping } from "../../core/sync.js";

const GROUP_GAP = 5 * 60000;   // 5 分钟内同一个人算一组
const PAGE = 150;              // 先画最后 150 条，滑到顶再往前加
let shownN = PAGE;

// 选了再删：连这几条的图、视频、封面、文件一起删
const alsoOf = ids => {
  const ms = S.list.filter(m => ids.includes(m.id));
  return [{ room: "pics", ids: ms.flatMap(m => mediaOf(m).pics) }, { room: "files", ids: ms.flatMap(m => mediaOf(m).files) }];
};
export const sel = makeSelect("chat", ROOM, "message", () => paint(true), { also: alsoOf });

const dayOf = ts => T.ymd(new Date(ts || 0));
function row(m, prev) {
  const t = m.createdAt || 0, who = m.by === "ke" ? "ke" : "me";
  const newDay = !prev || dayOf(t) !== dayOf(prev.createdAt);
  const first = newDay || prev.by !== m.by || t - (prev.createdAt || 0) > GROUP_GAP;
  return (newDay ? `<div class="ch-time">${esc(T.dayWord(dayOf(t)))}</div>` : "") +
    `<div class="ch-row ${who}${first ? " first" : ""}${sel.rowClass(m.id)}" data-id="${m.id}">
      ${first ? avatar(who) : `<span class="ch-sp"></span>`}
      <div class="ch-line"><div class="ch-msg" data-msg="${m.id}">${body(m)}</div><span class="ch-tm">${T.clockOf(t)}</span></div>
      ${sel.mark(m.id)}
    </div>`;
}

// 画在屏上的是 S.list 从 from 起的这些条；drawn 记它们的「id:改的时间」，用来认出「只是后面多了几句」
let from = 0, drawn = [], drawnSel = false;
const sig = m => m.id + ":" + (m.updatedAt || 0);
const onlyNewAtEnd = () => !sel.on && !drawnSel && drawn.length > 0 && S.list.length - from >= drawn.length
  && drawn.every((x, i) => x === sig(S.list[from + i]));

// 来了新的就只把新的接在后面（滚动、图、正在放的音频都不动）；别的变动（删、改、收藏、选、换头像、往前翻）整页重画
export function paint(all = false) {
  const sc = S.sc; if (!sc) return;
  sel.paint(S.list.map(m => m.id), sc);
  if (!all && onlyNewAtEnd()) {
    const add = S.list.slice(from + drawn.length);
    sc.querySelectorAll(".ch-typing").forEach(x => x.remove());
    sc.insertAdjacentHTML("beforeend", add.map((m, i) => row(m, i ? add[i - 1] : S.list[from + drawn.length - 1])).join("") + typingLine());
    drawn = drawn.concat(add.map(sig));
  } else {
    from = Math.max(0, S.list.length - shownN);
    const ms = S.list.slice(from);
    const top = sc.scrollTop;
    sc.innerHTML = (ms.length ? ms.map((m, i) => row(m, ms[i - 1])).join("") : `<div class="empty"><span class="script">Nothing yet.</span></div>`) + typingLine();
    sc.scrollTop = top;
    drawn = ms.map(sig); drawnSel = sel.on;
  }
  M.fill(sc);
  paintAudio();
}
const typingLine = () => isTyping() ? `<div class="ch-typing">Ke is typing…</div>` : "";
// 滑到顶：再往前画一页，停在原来看的那句
export function moreAbove() {
  const sc = S.sc;
  if (sc.scrollTop >= 40 || shownN >= S.list.length) return;
  const fromBottom = sc.scrollHeight - sc.scrollTop;
  shownN += PAGE; paint(true);
  sc.scrollTop = sc.scrollHeight - fromBottom;
}
export const toBottom = () => { if (S.sc) S.sc.scrollTop = S.sc.scrollHeight; };

// 跳到某一句（点引用、收藏）：滑过去，那一行亮一下
export function jump(id) {
  const i = S.list.findIndex(m => m.id === id);
  if (i < 0) { toast("That message is gone"); return; }
  if (S.list.length - i > shownN) { shownN = S.list.length - i + 20; paint(true); }
  const row = S.sc.querySelector(`.ch-row[data-id="${id}"]`); if (!row) return;
  // 只滑聊天这一块，让那句停在中间。别用 scrollIntoView：它连外面整页一起挪，手机上底下会空出一截白
  const box = S.sc.getBoundingClientRect(), r = row.getBoundingClientRect();
  S.sc.scrollTop += r.top - box.top - (box.height - r.height) / 2;
  row.classList.add("flash"); setTimeout(() => row.classList.remove("flash"), 1200);
}

// 头像换了：顶栏（在 Chat 时）和聊天一起重画
export const here = () => current() && current().id === "chat";
export const retitleIfHere = () => { if (here()) { retitle(); M.fill(document.getElementById("pageTitle")); } };
export async function loadAv() {
  S.av = { me: await db.getMeta("avatarMe", null), ke: await db.getMeta("avatarKe", null) };
  retitleIfHere(); paint(true);
}
