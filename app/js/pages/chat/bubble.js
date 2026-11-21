// 一条消息长什么样：字（方圆气泡带小尖角）、图、视频、音频、文件、克加东西的卡；还有头像
import * as T from "../../core/time.js";
import * as M from "../../core/media.js";
import { esc } from "../../core/ui.js";
import { I } from "../../core/icons.js";
import { S } from "./state.js";

// 头像：库里挑的那张，没挑就是灰方块里写 Ke／Me
export const avatar = (who, cls = "") => {
  const id = S.av[who];
  return `<span class="ch-av ${cls}">${id ? `<img data-pic="${id}" data-room="avatars" src="${M.cached(id)}" alt="">` : who === "ke" ? "Ke" : "Me"}</span>`;
};
// 视频、音频多长：没读出来（0 或无限长）就不写
export const len = d => d && isFinite(d) ? M.durWord(d) : "";
export const whenWord = ts => T.dayWord(T.ymd(new Date(ts))) + " " + T.clockOf(ts);
// 一条的短说法：引用、收藏列表、回复小条用
export const gist = m => m.text ? m.text
  : m.pics ? (m.pics.length > 1 ? m.pics.length + " photos" : "Photo")
  : m.kind === "video" ? "Video" : m.kind === "card" ? m.card.title : m.name || "File";

function pics(m, star) {
  const ps = m.pics.slice(0, 4), extra = m.pics.length - 4;
  const one = (id, i) => `<span class="ch-pic"><img data-pic="${id}" src="${M.cached(id)}" data-view="${id}" alt="">${i === 3 && extra > 0 ? `<i class="ch-more">+${extra}</i>` : ""}</span>`;
  return `<div class="ch-pics n${ps.length}">${ps.map(one).join("")}${star}</div>`;
}
const video = (m, star) => `<div class="ch-video" data-play-video="${m.file}">
  ${m.poster ? `<img data-pic="${m.poster}" src="${M.cached(m.poster)}" alt="">` : ""}<span class="ch-vplay">${I.play}</span>${len(m.dur) ? `<i>${len(m.dur)}</i>` : ""}${star}</div>`;
const audio = (m, star) => `<div class="ch-file" data-audio="${m.file}">
  <span class="ch-fi">${I.play}</span>
  <div class="ch-ft"><div class="fn">${esc(m.name)}</div><div class="fs"><span class="ch-at">${len(m.dur) || "Audio"}</span></div><div class="ch-track"><i></i></div></div>${star}</div>`;
const file = (m, star) => `<div class="ch-file" data-file="${m.file}">
  <span class="ch-fi">${I.doc}</span>
  <div class="ch-ft"><div class="fn">${esc(m.name)}</div><div class="fs">${M.sizeWord(m.size || 0)}</div></div>${star}</div>`;
const card = (m, star) => `<div class="ch-card" data-route="${esc(m.card.route || "")}">
  <span class="label">${esc(m.card.label || "")}</span><div class="big">${esc(m.card.title)}</div>${m.card.sub ? `<div class="sm">${esc(m.card.sub)}</div>` : ""}${star}</div>`;
function text(m, star) {
  const q = m.replyTo ? S.list.find(x => x.id === m.replyTo) : null;
  const quote = m.replyTo ? `<div class="ch-q" data-jump="${m.replyTo}">${esc(q ? gist(q) : "Deleted message")}</div>` : "";
  return `<div class="ch-b tail">${quote}<span class="ch-tx">${esc(m.text)}</span>${m.editedAt ? `<span class="ch-ed">Edited</span>` : ""}${star}</div>`;
}

export function body(m) {
  const star = m.star ? `<span class="ch-star" aria-label="Starred">★</span>` : "";
  if (m.pics && m.pics.length) return pics(m, star);
  const draw = { video, audio, file, card }[m.kind] || text;
  return draw(m, star);
}
