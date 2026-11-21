// 音频：同一时间只放一首；卡上播放键换暂停，下面一条进度
import * as M from "../../core/media.js";
import { toast } from "../../core/ui.js";
import { I } from "../../core/icons.js";
import { S } from "./state.js";
import { len } from "./bubble.js";

let audio = null, audioId = null;
export async function toggleAudio(id) {
  if (audioId === id && audio) { audio.paused ? audio.play() : audio.pause(); return; }
  if (audio) audio.pause();
  audio = new Audio(await M.url(id, "files")); audioId = id;
  audio.ontimeupdate = audio.onpause = audio.onplay = audio.onended = paintAudio;
  audio.play().catch(() => toast("Can't play this file"));
}
export function paintAudio() {
  if (!S.sc) return;
  S.sc.querySelectorAll("[data-audio]").forEach(c => {
    const mine = c.dataset.audio === audioId && audio, playing = mine && !audio.paused;
    c.querySelector(".ch-fi").innerHTML = playing ? I.pause : I.play;
    if (!mine) return;
    c.querySelector(".ch-at").textContent = M.durWord(audio.currentTime) + (len(audio.duration) ? " / " + len(audio.duration) : "");
    c.querySelector(".ch-track i").style.width = (audio.duration ? audio.currentTime / audio.duration * 100 : 0) + "%";
  });
}
// 正在放的那首被删了就停
export function stopAudio(fileId) { if (audioId === fileId && audio) { audio.pause(); audio = null; audioId = null; } }
