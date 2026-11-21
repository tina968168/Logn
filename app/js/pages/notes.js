// Notes：写、改、删，第一行当标题，能带图。顶上左边按写的时间／按改的时间排，右边一行一条（按月分组）／两列卡片
import * as db from "../core/db.js";
import * as T from "../core/time.js";
import * as M from "../core/media.js";
import { on } from "../core/bus.js";
import { makeSelect } from "../core/select.js";
import { h, esc, toast } from "../core/ui.js";
import { I } from "../core/icons.js";
import { detailSheet, editSheet } from "../core/card.js";
import { textField } from "../core/fields.js";

const ROOM = "notes";
let el, sc, list = [], view = null, order = null;   // view：list／grid；order：written／edited。都记在 meta 里，下次打开还是这个
const picsOf = ids => list.filter(n => ids.includes(n.id)).flatMap(n => n.pics || []);
const sel = makeSelect("notes", ROOM, "note", () => paint(), { also: ids => [{ room: "pics", ids: picsOf(ids) }] });

// 第一行当标题，剩下的是正文；只有图没有字的叫 Photo／N photos
const lines = n => (n.text || "").split("\n").map(x => x.trim()).filter(Boolean);
const photoWord = k => k === 1 ? "Photo" : k + " photos";
const titleOf = n => lines(n)[0] || photoWord((n.pics || []).length);
const restOf = n => lines(n).slice(1).join(" ");
// 详情里的正文：保留换行
const bodyOf = n => lines(n).length ? (n.text || "").trim().split("\n").slice(1).join("\n").trim() : "";
// 排序、分组、显示的日子都跟着选的那种走：按写的时间看 createdAt，按改的时间看 updatedAt
const stamp = n => order === "written" ? (n.createdAt || 0) : (n.updatedAt || n.createdAt || 0);
const dayOf = n => T.ymd(new Date(stamp(n)));
const edited = n => n.updatedAt && n.updatedAt - (n.createdAt || 0) > 60000;
const monthKey = s => s.slice(0, 7);

export const page = {
  id: "notes", name: "Notes",
  icon: `<path d="M6 4h9l3 3v13H6z"/><path d="M9 11h6M9 15h4"/>`,
  action: { label: "New note", run: () => edit(null) },
  mount(node) {
    el = node;
    el.appendChild(h(`<div class="scroll" id="ntScroll"></div>`));
    sc = el.querySelector("#ntScroll");
    sc.onclick = onClick;
    on("change", e => { if (e.room === ROOM) load(); });
    load();
  },
  refresh: () => load(),
  select: sel,
  async open(id) { const n = await db.get(ROOM, id); if (n) detail(n); },
};

async function load() {
  if (!view) view = await db.getMeta("notesView", "list");
  if (!order) order = await db.getMeta("notesOrder", "edited");
  list = await db.all(ROOM);
  paint();
}

// 一行一条：标题、正文头一句、日子；有图右边一张小图，多张角上写几张
function row(n) {
  const pics = n.pics || [], rest = restOf(n);
  const sub = [T.dayWord(dayOf(n)), n.by === "ke" ? "From Ke" : ""].filter(Boolean).join(" · ");
  return `<div class="lrow nt-row${sel.rowClass(n.id)}" data-id="${n.id}">
    <div class="lrow-text"><div class="t${lines(n).length ? "" : " muted"}">${esc(titleOf(n))}</div>${rest ? `<div class="p">${esc(rest)}</div>` : ""}<div class="s">${esc(sub)}</div></div>
    ${pics.length ? `<span class="lrow-end nt-thumb"><img data-pic="${pics[0]}" src="${M.cached(pics[0])}" alt="">${pics.length > 1 ? `<i>${pics.length}</i>` : ""}</span>` : ""}
    ${sel.mark(n.id)}
  </div>`;
}

// 两列卡片：有图的上面一张图，下面标题、几行正文、日子
function card(n) {
  const pics = n.pics || [], rest = restOf(n);
  const sub = [T.dayWord(dayOf(n)), pics.length > 1 ? pics.length + " photos" : "", n.by === "ke" ? "From Ke" : ""].filter(Boolean).join(" · ");
  return `<div class="nt-card${sel.rowClass(n.id)}" data-id="${n.id}">
    ${pics.length ? `<div class="img"><img data-pic="${pics[0]}" src="${M.cached(pics[0])}" alt=""></div>` : ""}
    <div class="in"><div class="t${lines(n).length ? "" : " muted"}">${esc(titleOf(n))}</div>${rest ? `<div class="p">${esc(rest)}</div>` : ""}<div class="s">${esc(sub)}</div></div>
    ${sel.mark(n.id)}
  </div>`;
}
// 卡片按顺序放进较矮的那列（按估的高度，不量 DOM：页没显示时量不出来），左右读下来还是新的在前
function columns(ns) {
  const cols = [[], []], hgt = [0, 0];
  for (const n of ns) {
    const k = hgt[0] <= hgt[1] ? 0 : 1;
    cols[k].push(n);
    hgt[k] += ((n.pics || []).length ? 120 : 0) + 64 + Math.min(4, Math.ceil(restOf(n).length / 12)) * 18;
  }
  return `<div class="nt-grid">${cols.map(c => `<div class="nt-col">${c.map(card).join("")}</div>`).join("")}</div>`;
}

function paint() {
  const day = T.today();
  list.sort((a, b) => stamp(b) - stamp(a));
  let html = "";
  if (!list.length) html = `<div class="empty"><span class="script">Nothing yet.</span></div>`;
  else {
    html = `<div class="nt-top"><div class="tabs nt-sort">
      <button data-order="written" class="${order === "written" ? "on" : ""}">Written</button>
      <button data-order="edited" class="${order === "edited" ? "on" : ""}">Edited</button></div>
      <div class="tabs nt-view">
      <button data-view="list" class="${view === "list" ? "on" : ""}" aria-label="List view">${I.list}</button>
      <button data-view="grid" class="${view === "grid" ? "on" : ""}" aria-label="Grid view">${I.grid}</button></div></div>`;
    if (view === "grid") html += columns(list);
    else {
      const months = [...new Set(list.map(n => monthKey(dayOf(n))))];
      html += months.map(m => `<div class="sec"><span class="label">${esc(T.monthWord(m, day))}</span></div>
        <div class="box">${list.filter(n => monthKey(dayOf(n)) === m).map(row).join("")}</div>`).join("");
    }
  }
  const top = sc.scrollTop;
  sel.paint(list.map(n => n.id), sc);
  sc.innerHTML = html; sc.scrollTop = top;
  M.fill(sc);
}

async function onClick(e) {
  const v = e.target.closest("[data-view]");
  if (v) { if (v.dataset.view !== view) { view = v.dataset.view; sc.scrollTop = 0; paint(); await db.setMeta("notesView", view); } return; }
  const r = e.target.closest("[data-order]");
  if (r) { if (r.dataset.order !== order) { order = r.dataset.order; sc.scrollTop = 0; paint(); await db.setMeta("notesOrder", order); } return; }
  if (sel.click(e)) return;            // 在选的时候，点一条＝勾上／取消
  const o = e.target.closest("[data-id]");
  if (o) { const n = list.find(x => x.id === o.dataset.id); if (n) detail(n); }
}


// 详情：全文和图，点图看大图
function detail(n) {
  const pics = n.pics || [];
  const extra = pics.length ? h(`<div class="nt-pics${pics.length === 1 ? " one" : ""}">${pics.map(id => `<img data-pic="${id}" src="${M.cached(id)}" alt="">`).join("")}</div>`) : null;
  if (extra) { M.fill(extra); extra.onclick = e => { const im = e.target.closest("img"); if (im && im.src) M.view({ src: im.src, id: im.dataset.pic }); }; }
  const at = ts => esc(T.fullDate(T.ymd(new Date(ts)))) + " · " + T.clockOf(ts);
  detailSheet({
    text: titleOf(n), note: bodyOf(n), extra, onEdit: () => edit(n),
    rows: [
      ["Written", at(n.createdAt)],
      edited(n) ? ["Edited", at(n.updatedAt)] : null,
      ["Added by", n.by === "ke" ? "Ke" : "You"],
    ],
  });
}

// 新建／修改：一个写字的框，下面图（四个一排，右上 × 去掉）和 Add photos…
// 新加的图先压好放手边，点 Save 才存进去；去掉的旧图 Save 以后才删。Cancel 什么都不动
function edit(n) {
  const isNew = !n;
  n = n || { text: "", pics: [] };
  const text = textField({ label: "Note", value: n.text || "", placeholder: "First line is the title", rows: 6, max: 360 });
  let shown = (n.pics || []).map(id => ({ id }));          // 现在框里的图：旧的 {id}，新加的 {p, src}
  const field = h(`<div class="field"><span class="label">Photos</span><div class="nt-edit-pics"></div>
    <button type="button" class="opt nt-add"><span>Add photos…</span></button></div>`);
  const strip = field.querySelector(".nt-edit-pics");
  const paintPics = () => {
    strip.innerHTML = shown.map((x, i) => `<div class="ph"><img ${x.id ? `data-pic="${x.id}" src="${M.cached(x.id)}"` : `src="${x.src}"`} alt="">
      <button type="button" data-rm="${i}" aria-label="Remove photo"><i>${I.x}</i></button></div>`).join("");
    M.fill(strip);
  };
  strip.onclick = e => { const b = e.target.closest("[data-rm]"); if (!b) return; const x = shown.splice(+b.dataset.rm, 1)[0]; if (x.src) URL.revokeObjectURL(x.src); paintPics(); };
  field.querySelector(".nt-add").onclick = async () => {
    const files = await M.pick(); if (!files.length) return;
    let bad = 0;
    for (const f of files) { const p = await M.shrink(f); if (p) shown.push({ p, src: URL.createObjectURL(p.blob) }); else bad++; }
    if (bad) toast(bad === 1 ? "Couldn't read 1 photo" : `Couldn't read ${bad} photos`);
    paintPics();
  };
  paintPics();
  editSheet({
    isNew, newTitle: "New note", noun: "note",
    fields: [text, field],
    values: () => ({ text: text.get(), pics: shown.map(x => x.id || x.src) }),
    async save() {
      const t = text.get();
      if (!t && !shown.length) { toast("Write something first"); return false; }
      const ids = [];
      for (const x of shown) ids.push(x.id || await M.savePic(x.p));
      await db.put(ROOM, { ...n, text: t, pics: ids });
      const gone = (n.pics || []).filter(id => !ids.includes(id));
      if (gone.length) await db.delMany("pics", gone);
    },
    async remove() {
      await db.del(ROOM, n.id);
      if ((n.pics || []).length) await db.delMany("pics", n.pics);
    },
    leave: () => shown.forEach(x => { if (x.src) URL.revokeObjectURL(x.src); }),     // 新加没存的图，临时地址收回
  });
}
