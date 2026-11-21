// Chat 几个文件共用的：仓库名、页面元素、全部消息（按时间排）、两个人用的头像
export const ROOM = "messages";
export const S = { el: null, sc: null, list: [], av: { me: null, ke: null } };

// 一条挂着的图和文件：删这条时一起删
export const mediaOf = m => ({ pics: [...(m.pics || []), ...(m.poster ? [m.poster] : [])], files: m.file ? [m.file] : [] });
