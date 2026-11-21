// 右上 ···：Starred、Photos & videos、Files、Avatars；每个子页左上 Back 回到这里
import * as db from "../../core/db.js";
import * as T from "../../core/time.js";
import * as M from "../../core/media.js";
import { h, esc, sheet, toast, actions } from "../../core/ui.js";
import { I } from "../../core/icons.js";
import { ROOM } from "./state.js";
import { inApp } from "../../core/native.js";
import { avatar, gist, len, whenWord } from "./bubble.js";
import { jump } from "./view.js";
import { avatars } from "./avatars.js";

const newestFirst = xs => xs.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
const sub = (title, body) => sheet({ title, left: { label: "Back", run: () => more() }, body });
// 按月分组：This month、October……
const monthOf = ts => T.ymd(new Date(ts)).slice(0, 7);
const byMonth = (xs, ts, draw) => [...new Set(xs.map(x => monthOf(ts(x))))]
  .map(mo => `<div class="sec"><span class="label">${esc(T.monthWord(mo))}</span></div>${draw(xs.filter(x => monthOf(ts(x)) === mo))}`).join("");

export async function more() {
  const all = await db.all(ROOM);
  const n = {
    star: all.filter(m => m.star).length,
    media: all.reduce((k, m) => k + (m.pics ? m.pics.length : 0) + (m.kind === "video" ? 1 : 0), 0),
    files: all.filter(m => m.kind === "file" || m.kind === "audio").length,
  };
  const item = (k, icon, name, count) => `<button data-k="${k}"><span class="ch-fi">${I[icon]}</span><span class="nm">${name}</span><i>${count || ""}</i>${I.next}</button>`;
  const body = h(`<div class="ch-list">
    ${item("star", "star", "Starred", n.star)}
    ${item("media", "img", "Photos &amp; videos", n.media)}
    ${item("files", "doc", "Files", n.files)}
    ${item("avatars", "user", "Avatars", 0)}
  </div>`);
  body.onclick = e => { const b = e.target.closest("[data-k]"); if (b) ({ star: starred, media: gallery, files: fileList, avatars: () => avatars(sub) })[b.dataset.k](); };
  sheet({ title: "More", left: { label: "Close", run: s => s.close() }, body });
}

// 文件点了：打开或存到手机（装在手机里时只能存，存好用手机自己的文件 app 打开）
export async function fileMenu(id) {
  const v = await actions(inApp ? [{ v: "save", label: "Save to phone" }] : [{ v: "open", label: "Open" }, { v: "save", label: "Save to phone" }]);
  if (v === "open") { const u = await M.url(id, "files"); if (u) window.open(u, "_blank"); }
  if (v === "save" && await M.download(id)) toast("Saved");
}

// 收藏的：点了跳回那句
async function starred() {
  const xs = newestFirst((await db.all(ROOM)).filter(m => m.star));
  const rowOf = m => `<button class="ch-srow" data-id="${m.id}">${avatar(m.by === "ke" ? "ke" : "me", "sm")}
    <span class="ch-st"><span class="t">${esc(gist(m))}</span><span class="s">${m.by === "ke" ? "Ke" : "You"} · ${esc(whenWord(m.createdAt))}</span></span></button>`;
  const body = h(`<div class="ch-starred">${xs.length ? xs.map(rowOf).join("") : `<div class="ch-none">Nothing starred yet.</div>`}</div>`);
  M.fill(body);
  const s = sub("Starred", body);
  body.onclick = e => { const b = e.target.closest("[data-id]"); if (b) { s.close(); jump(b.dataset.id); } };
}

// 照片和视频：按月，三个一排；点了看大图／放视频
async function gallery() {
  const items = newestFirst(await db.all(ROOM)).flatMap(m =>
    m.pics ? m.pics.map(id => ({ id, at: m.createdAt }))
    : m.kind === "video" ? [{ id: m.file, poster: m.poster, video: true, dur: m.dur, at: m.createdAt }] : []);
  const cell = x => x.video
    ? `<button data-v="${x.id}" class="vid">${x.poster ? `<img data-pic="${x.poster}" src="${M.cached(x.poster)}" alt="">` : ""}<i>▶ ${len(x.dur)}</i></button>`
    : `<button data-p="${x.id}"><img data-pic="${x.id}" src="${M.cached(x.id)}" alt=""></button>`;
  const body = h(`<div>${items.length ? byMonth(items, x => x.at, xs => `<div class="ch-grid">${xs.map(cell).join("")}</div>`) : `<div class="ch-none">No photos or videos yet.</div>`}</div>`);
  M.fill(body);
  sub("Photos & videos", body);
  body.onclick = async e => {
    const p = e.target.closest("[data-p]"); if (p) M.view({ src: await M.url(p.dataset.p), id: p.dataset.p });
    const v = e.target.closest("[data-v]"); if (v) M.view({ src: await M.url(v.dataset.v, "files"), video: true, id: v.dataset.v });
  };
}

// 文件（连音频）：按月，一行一个
async function fileList() {
  const xs = newestFirst((await db.all(ROOM)).filter(m => m.kind === "file" || m.kind === "audio"));
  const rowOf = m => `<button class="lrow ch-frow" data-f="${m.file}"><span class="ch-fi">${m.kind === "audio" ? I.play : I.doc}</span>
    <div class="lrow-text"><div class="t">${esc(m.name)}</div><div class="s">${M.sizeWord(m.size || 0)} · ${m.by === "ke" ? "Ke" : "You"} · ${esc(T.dayWord(T.ymd(new Date(m.createdAt))))}</div></div></button>`;
  const body = h(`<div>${xs.length ? byMonth(xs, m => m.createdAt, ms => `<div class="box">${ms.map(rowOf).join("")}</div>`) : `<div class="ch-none">No files yet.</div>`}</div>`);
  sub("Files", body);
  body.onclick = e => { const b = e.target.closest("[data-f]"); if (b) fileMenu(b.dataset.f); };
}
