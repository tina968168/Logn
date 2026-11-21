// Chat：我和克说话。几个文件各管一块：
// state 共用的东西；bubble 一条长什么样；view 画整页、跳到某句；press 长按工具条；compose 写和发；audio 放音频；more 右上 ···；avatars 头像库
// 跟服务器来回、Done 叫克在 core/sync.js
import * as db from "../../core/db.js";
import * as M from "../../core/media.js";
import { on } from "../../core/bus.js";
import { h, toast } from "../../core/ui.js";
import { I } from "../../core/icons.js";
import { route } from "../../core/shell.js";
import { S, ROOM } from "./state.js";
import { sel, paint, moreAbove, toBottom, jump, here, retitleIfHere, loadAv } from "./view.js";
import { watchPress, swallowClick } from "./press.js";
import { composeHtml, watchCompose } from "./compose.js";
import { toggleAudio } from "./audio.js";
import { more, fileMenu } from "./more.js";
import { syncNow, online } from "../../core/sync.js";

export const page = {
  id: "chat", name: "Chat", trash: false,          // 没有垃圾桶：长按一条点 Select 进多选
  icon: `<path d="M5 6h14v10H10l-4 3v-3H5z"/>`,
  title: () => `<span class="ch-head">Ke</span>`,          // 只写名字，在顶栏正中
  action: { label: "More", icon: I.more, run: () => more() },
  extra: { label: "Done", icon: I.clawd, run: () => done() },      // 用户写完点 Clawd（就是原来的 Done）：叫克来看
  mount(node) {
    S.el = node;
    node.appendChild(h(`<div class="ch-page"><div class="scroll ch-scroll" id="chScroll"></div>${composeHtml}</div>`));
    S.sc = node.querySelector("#chScroll");
    S.sc.onclick = onClick;
    S.sc.addEventListener("scroll", moreAbove, { passive: true });
    watchPress();
    watchCompose();
    on("change", e => { if (e.room === ROOM) load(); });
    on("meta", e => { if (e.key === "avatarMe" || e.key === "avatarKe") loadAv(); });
    on("typing", () => { const sc = S.sc, atBottom = sc.scrollHeight - sc.scrollTop - sc.clientHeight < 60; paint(); if (atBottom) toBottom(); });
    loadAv(); load();
  },
  refresh: () => load(true),          // 过了零点、切回来：整页重画（Today／Yesterday 要跟着变）
  select: sel,
  shown() { seen(); toBottom(); retitleIfHere(); },
  async count() { const s = await db.getMeta("chatSeen", 0); return (await db.all(ROOM)).filter(m => m.by === "ke" && (m.createdAt || 0) > s).length; },   // 克发的没看的
  async open(id) { jump(id); },
};

async function load(all = false) {
  const sc = S.sc, atBottom = sc.scrollHeight - sc.scrollTop - sc.clientHeight < 60;
  S.list = (await db.all(ROOM)).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  paint(all);
  if (atBottom) toBottom();
  if (here() && !document.hidden) seen();
}
// Done：先把没交的交上去，再叫克；连不上就说一声
async function done() {
  if (!online()) { toast("Not connected"); return; }
  if (!(await syncNow({ call: true }))) toast("Couldn't reach Ke. Try again");
}
// 看过了：克发的没看的数字清掉
async function seen() {
  const newest = S.list.length ? S.list[S.list.length - 1].createdAt || 0 : 0;
  if (newest > (await db.getMeta("chatSeen", 0))) await db.setMeta("chatSeen", newest);
}

async function onClick(e) {
  if (swallowClick()) return;
  if (sel.click(e)) return;
  const t = e.target, at = k => t.closest(`[data-${k}]`);
  let x;
  if ((x = at("jump"))) jump(x.dataset.jump);                                                         // 引用：跳回原句
  else if ((x = at("view"))) M.view({ src: await M.url(x.dataset.view), id: x.dataset.view });          // 图：看大图
  else if ((x = at("play-video"))) M.view({ src: await M.url(x.dataset.playVideo, "files"), video: true, id: x.dataset.playVideo });
  else if ((x = at("audio"))) toggleAudio(x.dataset.audio);
  else if ((x = at("file"))) fileMenu(x.dataset.file);
  else if ((x = at("route")) && x.dataset.route) route(x.dataset.route);                               // 克加东西的卡：跳过去
}
