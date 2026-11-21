# Logn

A small, calm daily app for Android: **Reminders · Chat · Days · Notes**.
Everything lives on your phone. An optional tiny server lets someone on the other side (a friend, yourself on a computer, or your own AI) chat with you and edit the same lists.

一个安静的日用小 app：提醒、聊天、纪念日、笔记。数据存在手机里；想要另一头陪你聊、帮你加提醒，就自己起一个小服务器。

## 有什么

| 页 | 做什么 |
|---|---|
| Reminders | 打开就是它。按日子提醒，可重复（每天／每周／每月／每年／每年第几个星期几），默认提前一天＋当天各响一次 |
| Chat | 跟另一头说话，能发图、视频、文件、语音；写完点右上的按钮叫对方来看 |
| Days | 纪念日、生日，支持农历，显示还有几天／过了几天 |
| Notes | 笔记，第一行当标题 |

界面英文，内容随便写；12 小时制；没有多余动画。

## 文件夹

```
app/       网页本体（index.html、css、js、fonts），整份装进 APK，不连网也能开
android/   安卓壳（Java）和打包脚本 build.sh
server/    可选：同步服务器 logn_server.py 和另一头用的命令 logn（只用 Python 标准库）
```

## 打包 APK

要 Android SDK（build-tools 34.0.0、platforms/android-34）、JDK、Python 3。

```bash
# 先做一把自己的签名钥匙（只做一次，丢了以后的新包就装不到旧的上面）
keytool -genkeypair -keystore logn.keystore -alias logn -keyalg RSA -validity 10000

cd android
ANDROID_SDK=/path/to/android-sdk KEYSTORE=../logn.keystore KS_PASS=你的密码 ./build.sh
# 出来 android/Logn.apk
```

不填 `LOGN_SERVER` 就是纯手机版：提醒、纪念日、笔记都能用，Chat 没人回。

## 想要另一头（可选）

在一台服务器上：

```bash
cd server
LOGN_TOKEN=自己起一个长暗号 PORT=8443 CERT=证书.pem KEY=私钥.pem python3 logn_server.py
```

安卓默认不让 app 连明文 http，所以要么给 `CERT`/`KEY`，要么在前面挂 Caddy／Nginx 做 https。
打包时把地址带上：

```bash
LOGN_SERVER=https://你的域名:8443/自己起的暗号 ANDROID_SDK=... KEYSTORE=... KS_PASS=... ./build.sh
```

另一头用 `server/logn`（跟服务器用同样的 `LOGN_DIR`、`LOGN_TOKEN`）：

```bash
./logn                    # 看最近的聊天；对方点了按钮还没回会写出来
./logn "话"               # 回一句
./logn -多 "话1" "话2"     # 一条条发，「在打字」亮到最后一句
./logn 提醒 加 2027-01-01 09:00 "交作业" 每周
./logn -h                 # 全部用法
```


手机是正本，服务器只留一份镜子：聊天、图、文件留 30 天，提醒、纪念日、笔记一直留。

## 接 Claude Code（cc）

Logn 本来就是给 cc 用的：Chat 右上的 Clawd 一点，cc 来看、来回，还能帮你加提醒、记纪念日、写笔记。

1. 按上一节把服务器起好、APK 带上地址装好。
2. 在服务器上开 Claude Code，把下面这段放进它的 `CLAUDE.md`（路径换成你自己的）：

```markdown
## Logn
我手机上有 Logn（Reminders、Chat、Days、Notes），你跟我权利一样，能看、加、改、删。
命令：`LOGN_DIR=/path/to/logn-data LOGN_TOKEN=暗号 /path/to/server/logn`（`-h` 看全部用法）。
我说「开监听」时，用 Monitor 跑 `LOGN_DIR=/path/to/logn-data python3 /path/to/server/listen.py`（timeout 设最长，到期重挂）。
每响一次：先跑 `logn` 看我写了什么，再用 `logn -多 "话1" "话2"` 一条条回我。
```

3. 跟 cc 说「开监听」。之后在手机上写完话点 Clawd，它就会回你；它回的时候你那边会显示「在打字」，app 在后台也会弹通知。

cc 也可以不等你点，自己用 `logn 提醒 加 …`、`logn 日子 加 …`、`logn 笔记 加 …` 往你手机里放东西，下次同步（开着 30 秒内）就到。

## 改着玩

- 颜色、字号、尺寸只在 `app/css/tokens.css`（白天一组、夜里一组），每页自己的样式在 `app/css/pages/`
- 每页一个文件在 `app/js/pages/`，存取、同步、弹层这些在 `app/js/core/`
- Chat 顶上的名字在 `app/js/pages/chat/index.js`
- 包名 `com.ke.logn` 想换就一起改 `android/AndroidManifest.xml` 和 `android/src/` 的目录、`package` 行
- 代码注释是中文

## 许可

代码：MIT，见 [LICENSE](LICENSE)。随便改、随便用，留着原作者名字就行。
字体：Plus Jakarta Sans、Italianno，都是 SIL Open Font License 1.1，许可在 `app/fonts/`。
