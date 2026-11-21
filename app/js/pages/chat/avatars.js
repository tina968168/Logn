// 头像库：两个人都能往里放图、删图（真删）；点一张选给谁用。open(title, body) 是 ··· 那边给的，左上 Back 回去
import * as db from "../../core/db.js";
import * as M from "../../core/media.js";
import { h, toast, confirm, actions } from "../../core/ui.js";
import { I } from "../../core/icons.js";
import { S } from "./state.js";
import { avatar } from "./bubble.js";
import { loadAv } from "./view.js";

export async function avatars(open) {
  const lib = (await db.all("avatars")).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const used = id => [S.av.me === id ? "You" : "", S.av.ke === id ? "Ke" : ""].filter(Boolean).join(" · ");
  const pic = a => `<button class="ch-lav" data-a="${a.id}"><img data-pic="${a.id}" data-room="avatars" src="${M.cached(a.id)}" alt="">${used(a.id) ? `<i>${used(a.id)}</i>` : ""}</button>`;
  const body = h(`<div class="ch-avs">
    <div class="ch-who"><div>${avatar("me", "big")}<span>You</span></div><div>${avatar("ke", "big")}<span>Ke</span></div></div>
    <div class="sec"><span class="label">Library</span></div>
    <div class="ch-lib"><button class="ch-add" aria-label="Add pictures">${I.add}</button>${lib.map(pic).join("")}</div>
  </div>`);
  M.fill(body);
  open("Avatars", body);
  const again = async () => { await loadAv(); avatars(open); };
  body.onclick = async e => {
    if (e.target.closest(".ch-add")) {
      const files = await M.pick("image/*", true); if (!files.length) return;
      let bad = 0;
      for (const f of files) { const p = await M.shrink(f, 512); if (p) await db.put("avatars", { blob: p.blob, w: p.w, h: p.h }, { quiet: true }); else bad++; }
      if (bad) toast(bad === 1 ? "Couldn't read 1 picture" : `Couldn't read ${bad} pictures`);
      avatars(open); return;
    }
    const b = e.target.closest("[data-a]"); if (!b) return;
    const id = b.dataset.a;
    const v = await actions([{ v: "me", label: "Use for me" }, { v: "ke", label: "Use for Ke" }, { v: "both", label: "Use for both" }, { v: "del", label: "Delete", red: true }]);
    if (!v) return;
    if (v === "del") {
      if (!(await confirm("Delete this picture? This can't be undone.", "Delete", true))) return;
      if (S.av.me === id) await db.setMeta("avatarMe", null);       // 正在用的被删了，换回灰方块
      if (S.av.ke === id) await db.setMeta("avatarKe", null);
      await db.del("avatars", id); toast("Deleted");
    } else {
      if (v === "me" || v === "both") await db.setMeta("avatarMe", id);
      if (v === "ke" || v === "both") await db.setMeta("avatarKe", id);
      toast("Avatar changed");
    }
    again();
  };
}
