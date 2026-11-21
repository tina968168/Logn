// 改动通知：哪个仓库变了，谁关心谁来听
const ears = {};
export const on = (name, fn) => { (ears[name] ||= []).push(fn); };
export const emit = (name, data) => { (ears[name] || []).forEach(fn => { try { fn(data); } catch (e) { console.error(e); } }); };
