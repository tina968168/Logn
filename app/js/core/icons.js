// 图标全放这里，各页、顶栏都从这拿；index.html 里写 <i data-icon="名字"></i>，外壳启动时换成图
export const I = {
  menu: `<svg viewBox="0 0 24 24"><path d="M4 7h10M4 12h16M4 17h7"/><circle cx="17" cy="7" r="2"/><circle cx="14" cy="17" r="2"/></svg>`,
  plus: `<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>`,
  add: `<svg viewBox="0 0 24 24"><path d="M12 6v12M6 12h12"/></svg>`,          // Chat 左下、头像库的 +，小一圈
  x: `<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>`,
  tick: `<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`,
  trash: `<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/></svg>`,
  all: `<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg>`,
  list: `<svg viewBox="0 0 24 24"><path d="M5 7h14M5 12h14M5 17h14"/></svg>`,
  grid: `<svg viewBox="0 0 24 24"><rect x="4.5" y="4.5" width="6" height="6" rx="1.5"/><rect x="13.5" y="4.5" width="6" height="6" rx="1.5"/><rect x="4.5" y="13.5" width="6" height="6" rx="1.5"/><rect x="13.5" y="13.5" width="6" height="6" rx="1.5"/></svg>`,
  more: `<svg class="fill" viewBox="0 0 24 24"><circle cx="5.5" cy="12" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="18.5" cy="12" r="1.9"/></svg>`,   // 实心（空心的像句号）
  // Clawd：Claude Code 的像素小螃蟹，Chat 右上叫克来看的按钮
  clawd: `<svg class="clawd" viewBox="0 0 16 12" shape-rendering="crispEdges"><g fill="#d97757"><rect x="2" y="0" width="12" height="8"/><rect x="0" y="3" width="2" height="2"/><rect x="14" y="3" width="2" height="2"/><rect x="3" y="8" width="1" height="3"/><rect x="5" y="8" width="1" height="3"/><rect x="10" y="8" width="1" height="3"/><rect x="12" y="8" width="1" height="3"/></g><g fill="#1c1c1e"><rect x="4.5" y="2" width="1.2" height="2.4"/><rect x="10.3" y="2" width="1.2" height="2.4"/></g></svg>`,
  next: `<svg class="next" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>`,
  doc: `<svg viewBox="0 0 24 24"><path d="M7 3.5h7l4 4V20H7z"/><path d="M14 3.5V8h4"/></svg>`,
  img: `<svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="14" rx="3"/><circle cx="9" cy="10" r="1.5"/><path d="M5 17l5-4 4 3 2-2 3 3"/></svg>`,
  play: `<svg class="fill" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>`,
  pause: `<svg class="fill" viewBox="0 0 24 24"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>`,
  send: `<svg viewBox="0 0 24 24"><path d="M12 18V7M7 11l5-5 5 5"/></svg>`,
  reply: `<svg viewBox="0 0 24 24"><path d="M10 7L5 12l5 5"/><path d="M5 12h9a5 5 0 0 1 5 5v1"/></svg>`,
  copy: `<svg viewBox="0 0 24 24"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h2"/></svg>`,
  edit: `<svg viewBox="0 0 24 24"><path d="M5 19l1-4L16 5l3 3L9 18z"/></svg>`,
  star: `<svg viewBox="0 0 24 24"><path d="M12 4.5l2.3 4.7 5.2.8-3.8 3.6.9 5.2L12 16.4 7.4 18.8l.9-5.2-3.8-3.6 5.2-.8z"/></svg>`,
  sel: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="7.5"/><path d="M8.8 12.2l2.2 2.2 4.2-4.4"/></svg>`,
  user: `<svg viewBox="0 0 24 24"><circle cx="12" cy="9" r="3.5"/><path d="M5.5 19a6.5 6.5 0 0 1 13 0"/></svg>`,
};
// 要给图加个 class 时用（表单里打勾的那个要 class="tick"）
export const iconWith = (name, cls) => I[name].replace("<svg", `<svg class="${cls}"`);
