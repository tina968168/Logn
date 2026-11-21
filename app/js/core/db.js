// 手机里的存储：一页一个仓库，图、文件（视频、音频、别的）、头像各一个，设置一个。写只碰改到的那个仓库。
import { emit } from "./bus.js";

export const ROOMS = ["reminders", "days", "notes", "messages", "pics", "files", "avatars", "meta"];
// 这几间跟服务器同步（core/sync.js）：删的记进待删单（meta 的 gone），下次同步交上去；服务器来的删除不记（fromServer）
export const SYNCED = ["reminders", "days", "notes", "messages", "pics", "files"];
const NAME = "logn", VERSION = 2;
let dbp = null;
const mem = {};                       // 打不开 IndexedDB 时（隐私模式之类）退到内存，页面照常能用

function open() {
  if (dbp) return dbp;
  dbp = new Promise(resolve => {
    // 有的环境（网页预览的沙盒）打开存储既不成功也不报错，一直挂着；等 1.5 秒还没开就退到内存，别让整个 app 卡住
    setTimeout(() => resolve(null), 1500);
    try {
      const r = indexedDB.open(NAME, VERSION);
      r.onupgradeneeded = () => { ROOMS.forEach(n => { if (!r.result.objectStoreNames.contains(n)) r.result.createObjectStore(n, { keyPath: "id" }); }); };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => resolve(null);
      r.onblocked = () => resolve(null);
    } catch (e) { resolve(null); }
  });
  return dbp;
}
function tx(db, room, mode, fn) {
  return new Promise((resolve, reject) => {
    const t = db.transaction(room, mode), s = t.objectStore(room);
    let out; const req = fn(s);
    if (req) req.onsuccess = () => { out = req.result; };
    t.oncomplete = () => resolve(out);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export async function all(room) {
  const db = await open();
  if (!db) return Object.values(mem[room] || {});
  return (await tx(db, room, "readonly", s => s.getAll())) || [];
}
export async function get(room, id) {
  const db = await open();
  if (!db) return (mem[room] || {})[id];
  return tx(db, room, "readonly", s => s.get(id));
}
// keepTime：从服务器来的、导入的，用它自己带的时间，不改成现在；fromServer：服务器来的，不记进改动单
export async function put(room, obj, { keepTime = false, quiet = false, fromServer = false } = {}) {
  const now = Date.now();
  const x = { ...obj };
  if (!x.id) x.id = newId();
  if (!keepTime || !x.createdAt) x.createdAt = x.createdAt || now;
  if (!keepTime || !x.updatedAt) x.updatedAt = now;
  if (!x.by && !["meta", "pics", "files"].includes(room)) x.by = "me";
  const db = await open();
  if (!db) (mem[room] ||= {})[x.id] = x;
  else await tx(db, room, "readwrite", s => s.put(x));
  if (!fromServer) await mark("dirty", room, [x.id]);
  if (!quiet) emit("change", { room, id: x.id });
  return x;
}
export async function del(room, id, { quiet = false, fromServer = false } = {}) {
  const db = await open();
  if (!db) { if (mem[room]) delete mem[room][id]; }
  else await tx(db, room, "readwrite", s => s.delete(id));
  await unmark("dirty", [[room, id]]);
  if (!fromServer) await mark("gone", room, [id]);
  if (!quiet) emit("change", { room, id, gone: true });
}
// 一次删几条（先选再删；连带删图、文件）
export async function delMany(room, ids) {
  const db = await open();
  if (!db) { ids.forEach(id => { if (mem[room]) delete mem[room][id]; }); }
  else await tx(db, room, "readwrite", s => ids.forEach(id => s.delete(id)));
  await unmark("dirty", ids.map(id => [room, id]));
  await mark("gone", room, ids);
  emit("change", { room, ids, gone: true });
}

// 两张单子，同步时交（core/sync.js）：dirty＝改过还没交的，gone＝删了还没交的；都是 [房, id]。
// 读改写排着来，几处同时写也不丢
let lineUp = Promise.resolve();
const inLine = fn => { const p = lineUp.then(fn); lineUp = p.catch(() => {}); return p; };
const key = (room, id) => room + "|" + id;
function mark(list, room, ids) {
  if (!SYNCED.includes(room) || !ids.length) return Promise.resolve();
  return inLine(async () => {
    const xs = await getMeta(list, []), have = new Set(xs.map(([r, i]) => key(r, i)));
    const add = ids.filter(id => !have.has(key(room, id))).map(id => [room, id]);
    if (add.length) await put("meta", { id: list, v: xs.concat(add) }, { quiet: true });
  });
}
export const listOf = list => inLine(() => getMeta(list, []));
export function unmark(list, pairs) {
  if (!pairs.length) return Promise.resolve();
  const out = new Set(pairs.map(([r, i]) => key(r, i)));
  return inLine(async () => {
    const xs = await getMeta(list, []), left = xs.filter(([r, i]) => !out.has(key(r, i)));
    if (left.length !== xs.length) await put("meta", { id: list, v: left }, { quiet: true });
  });
}
// 第一次用改动单（1.3 版起）：把以前按 syncedAt 判断还没交的补进单子，只做一次
export async function startLists() {
  if (await getMeta("listsReady", false)) return;
  for (const room of SYNCED) {
    const ids = (await all(room)).filter(x => x.syncedAt !== x.updatedAt).map(x => x.id);
    await mark("dirty", room, ids);
  }
  await put("meta", { id: "listsReady", v: true }, { quiet: true });
}

// 设置：meta 仓库里一条一个键
export async function getMeta(key, fallback = null) {
  const x = await get("meta", key);
  return x ? x.v : fallback;
}
export async function setMeta(key, v) {
  await put("meta", { id: key, v }, { quiet: true });
  emit("meta", { key, v });
}
