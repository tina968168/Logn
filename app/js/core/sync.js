// 跟服务器同步：手机里是正本，服务器留一份镜子给克看，克改的也从这拿回来。四页跟图、文件都同步，删就真删。
// 用户改过的在改动单上（db.js 的 dirty），只交单子上的那几条，图和文件先单独传；删的交待删单（gone）；
// 克的改按号拿回来，照着改手机里的（用户这边改得更晚、还没交的不盖）。用户点 Done 叫克来看。
// 只有装在手机里（壳给了服务器地址）才连；网页预览里什么都不做，测试里塞一个假壳连测试用的服务器
import * as db from "./db.js";
import * as T from "./time.js";
import { emit, on } from "./bus.js";
import { current } from "./shell.js";
import { serverBase, keArrived } from "./native.js";

const ROOMS = db.SYNCED, BLOBS = ["pics", "files"];
let typing = false, timer = 0, soon = 0, chain = Promise.resolve();
export const online = () => !!serverBase();
export const isTyping = () => typing;

const extOf = (room, x) => room === "pics" ? "jpg" : ((/\.([a-z0-9]{1,8})$/i.exec(x.name || "") || [])[1] || "bin").toLowerCase();
const gist = m => m.text || (m.card && m.card.title) || (m.pics ? "Photo" : m.name || "Message");

// 一次只跑一个，排着来；返回 true＝连上了
export function syncNow(opts = {}) {
  const p = chain.then(() => run(opts));
  chain = p.catch(() => false);
  return p.catch(() => { plan(); return false; });
}

async function run({ call = false }) {
  const base = serverBase(); if (!base) return false;
  const post = (path, body, json = true) => fetch(base + path, { method: "POST", headers: json ? { "Content-Type": "application/json" } : {}, body: json ? JSON.stringify(body) : body });

  // 1. 交上去：改动单上的整条（图、文件先传本身，传不上的这回先不交）
  const put = {};
  const dirty = await db.listOf("dirty");
  for (const [room, id] of dirty) {
    const x = await db.get(room, id);
    if (!x) continue;
    if (BLOBS.includes(room) && !(x.blob && (await post(`/logn/blob?id=${x.id}&ext=${extOf(room, x)}`, x.blob, false)).ok)) continue;
    const { blob, syncedAt, ...rec } = x;
    (put[room] ||= []).push(rec);
  }
  const gone = await db.listOf("gone"), got = await db.getMeta("syncGot", 0);
  const r = await post("/logn/sync", { put, gone, got, call });
  if (!r.ok) { plan(); return false; }
  const d = await r.json();

  // 2. 服务器存下的从改动单划掉（交完又改过的留着，下回再交）；待删单划掉交上去的
  const done = [];
  for (const [room, id, at] of d.ok || []) { const x = await db.get(room, id); if (!x || x.updatedAt === at) done.push([room, id]); }
  await db.unmark("dirty", done);
  await db.unmark("gone", d.gone || []);

  // 3. 克的改按号照着改；图、文件去拿本身，拿不到就停在这号，下回接着拿
  const left = new Set((await db.listOf("dirty")).map(([room, id]) => room + "|" + id));
  const touched = new Set(), fromKe = [];
  let upTo = got;
  for (const op of d.ops || []) {
    if (!ROOMS.includes(op.room)) { upTo = op.seq; continue; }
    if (op.op === "del") await db.del(op.room, op.id, { quiet: true, fromServer: true });
    else {
      let rec = op.rec;
      const mine = left.has(op.room + "|" + rec.id) ? await db.get(op.room, rec.id) : null;
      if (!(mine && (mine.updatedAt || 0) > (rec.updatedAt || 0))) {     // 用户这边改得更晚、还没交，留用户的
        if (BLOBS.includes(op.room)) {
          const b = await fetch(`${base}/logn/blob/${rec.id}`);
          if (!b.ok) break;
          rec = { ...rec, blob: await b.blob() };
        }
        if (op.room === "days" && rec.repeat === "lunar" && !rec.lunar) rec = { ...rec, lunar: T.lunarOf(rec.date) };
        await db.put(op.room, rec, { keepTime: true, quiet: true, fromServer: true });
        if (op.room === "messages" && rec.by === "ke") fromKe.push({ seq: op.seq, rec });
      }
    }
    touched.add(op.room);
    upTo = op.seq;
  }
  if (upTo > got) await db.setMeta("syncGot", upTo);
  touched.forEach(room => emit("change", { room, from: "sync" }));
  if (fromKe.length) {
    const k = fromKe[fromKe.length - 1], away = document.hidden || !current() || current().id !== "chat";
    keArrived(k.seq, fromKe.length > 1 ? `${fromKe.length} messages · ${gist(k.rec)}` : gist(k.rec), away);
  }
  if (!!d.typing !== typing) { typing = !!d.typing; emit("typing", typing); }
  plan();
  return true;
}

// 开着的时候 30 秒问一次；用户点了 Done、克在打字时 5 秒一次；切到后台就停（壳在后台每 3 分钟问）
function plan() {
  clearTimeout(timer);
  if (document.hidden || !online()) return;
  timer = setTimeout(() => syncNow(), typing ? 5000 : 30000);
}

export async function startSync() {
  if (!online()) return;
  await db.startLists();
  document.addEventListener("visibilitychange", () => { if (!document.hidden) syncNow(); else clearTimeout(timer); });
  // 用户改了什么：一秒后交上去（连着改几下只交一次）
  on("change", e => { if (ROOMS.includes(e.room) && e.from !== "sync") { clearTimeout(soon); soon = setTimeout(() => syncNow(), 1000); } });
  syncNow();
}
