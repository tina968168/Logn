// 启动：登记四页（侧栏顺序），开外壳，排响铃
import * as shell from "./core/shell.js";
import { on } from "./core/bus.js";
import { schedule } from "./core/alarms.js";
import { onRoute, onBack } from "./core/native.js";
import { startSync } from "./core/sync.js";
import { page as reminders } from "./pages/reminders.js";
import { page as chat } from "./pages/chat/index.js";
import { page as days } from "./pages/days.js";
import { page as notes } from "./pages/notes.js";

[reminders, chat, days, notes].forEach(shell.register);
await shell.start("reminders");
on("change", e => { if (e.room === "reminders" || e.room === "days") schedule(); });
schedule();
onRoute(r => shell.route(r));
onBack(() => shell.back());
startSync();
