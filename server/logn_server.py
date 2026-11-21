#!/usr/bin/env python3
"""Logn 同步服务器（可选）。不跑它，app 也能用，只是数据只在手机里、Chat 没人回。

手机里是正本，服务器留一份镜子；另一头（你自己、你的 AI、朋友）用同目录的 `logn` 命令看、回、加、改。
只用 Python 标准库。

环境变量：
  LOGN_TOKEN  暗号，写在网址里（不设就随机生成一个，存在 LOGN_DIR/token）
  LOGN_DIR    数据放哪（默认 ./logn-data）
  PORT        端口（默认 8080）
  CERT / KEY  证书和私钥路径；两个都给了就走 https（安卓默认不让 app 连明文 http，建议用 https 或在前面挂反向代理）
启动后 app 打包时填的服务器地址是 https://<你的域名或IP>:<端口>/<暗号>
"""
import os, re, sys, json, ssl, secrets, datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit, unquote

DIR   = os.path.abspath(os.environ.get("LOGN_DIR") or "logn-data")
PORT  = int(os.environ.get("PORT") or 8080)
CERT  = os.environ.get("CERT") or ""
KEY   = os.environ.get("KEY") or ""
CHUNK = 64 * 1024
os.makedirs(DIR, mode=0o700, exist_ok=True)
TOKEN = os.environ.get("LOGN_TOKEN") or ""
if not TOKEN:
    tf = os.path.join(DIR, "token")
    if os.path.exists(tf):
        TOKEN = open(tf).read().strip()
    else:
        TOKEN = secrets.token_hex(12)
        with open(os.open(tf, os.O_CREAT | os.O_WRONLY, 0o600), "w") as f:
            f.write(TOKEN)


def 前缀():
    return "/" + TOKEN


# ---- Logn：手机上的 app 跟另一头（下面叫「克」，by=ke）同步 ----
# 手机里是正本。服务器留一份镜子给克看：四页（reminders、days、notes、messages）和图、文件（pics、files）。
# 手机那边改了：app 把改过的整条交上来（同一条留 updatedAt 新的那份），删了交删单，服务器跟着删（连图和文件）。
# 另一头改了：`logn` 命令写进「改.json」（每条带号 seq），同时改镜子；app 交上它收到第几号，拿走后面的。
# 聊天、图、文件只留 30 天；提醒、日子、笔记一直留。时间一律毫秒数。
# 手机上点 Done 写「叫克」（毫秒），另一头在聊天里回一句就删；半小时没回也不再算「在打字」
LOGN = DIR
LOGN_镜 = os.path.join(LOGN, "镜")
LOGN_件 = os.path.join(LOGN, "件")          # 图、文件本身：<id>.<后缀>
LOGN_改 = os.path.join(LOGN, "改.json")
LOGN_号 = os.path.join(LOGN, "号")          # 号只往上走：旧的改过了 30 天删掉，号也不能从头来，不然 app 收不到
LOGN_叫 = os.path.join(LOGN, "叫克")
LOGN_问 = os.path.join(LOGN, "后台问")
LOGN_收 = os.path.join(LOGN, "手机收到")
LOGN_房 = ("reminders", "days", "notes", "messages", "pics", "files")
LOGN_短 = ("messages", "pics", "files")     # 只留 30 天的
LOGN_留 = 30 * 86400000
logn锁 = __import__("threading").Lock()     # 几个请求同时来时，读改写别串


def 毫秒():
    return int(datetime.datetime.now(datetime.timezone.utc).timestamp() * 1000)


def logn存(路, 内容):
    os.makedirs(os.path.dirname(路), exist_ok=True)
    临 = 路 + ".tmp"
    with open(临, "w", encoding="utf-8") as f:
        f.write(内容 if isinstance(内容, str) else json.dumps(内容, ensure_ascii=False))
    os.replace(临, 路)


def logn读(房):
    try:
        return json.load(open(os.path.join(LOGN_镜, 房 + ".json"), encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def logn件路(id):
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,40}", id or ""):
        return None
    if os.path.isdir(LOGN_件):
        for 名 in os.listdir(LOGN_件):
            if 名.split(".")[0] == id:
                return os.path.join(LOGN_件, 名)
    return None


def logn删件(id):
    路 = logn件路(id)
    if 路:
        os.remove(路)


def logn写(房, 镜):
    if 房 in LOGN_短:                           # 过了 30 天的连图、文件一起删
        底 = 毫秒() - LOGN_留
        for id in [k for k, v in 镜.items() if (v.get("createdAt") or 0) < 底]:
            镜.pop(id)
            if 房 != "messages":
                logn删件(id)
    logn存(os.path.join(LOGN_镜, 房 + ".json"), 镜)


def logn号():
    try:
        return int(open(LOGN_号).read().strip() or 0)
    except (OSError, ValueError):
        return 0


def logn叫():
    try:
        return int(open(LOGN_叫).read().strip() or 0)
    except (OSError, ValueError):
        return 0


def logn改(房, 作, x):
    """克这边改一条：作＝put（x 是整条）或 del（x 是 id）。记进改.json 给 app 拿，镜子跟着改。返回号。"""
    with logn锁:
        号 = logn号() + 1
        logn存(LOGN_号, str(号))
        改 = [c for c in 读json(LOGN_改) if c.get("at", 0) >= 毫秒() - LOGN_留]
        条 = {"seq": 号, "room": 房, "op": 作, "at": 毫秒()}
        镜 = logn读(房)
        if 作 == "put":
            条["rec"] = x
            镜[x["id"]] = x
        else:
            条["id"] = x
            镜.pop(x, None)
            if 房 in ("pics", "files"):
                logn删件(x)
        改.append(条)
        logn存(LOGN_改, 改)
        logn写(房, 镜)
        if 房 == "messages" and 作 == "put" and x.get("by") == "ke" and x.get("kind") != "card":
            try:
                os.remove(LOGN_叫)                  # 克回话了，「在打字」就停
            except OSError:
                pass
        return 号


def 读json(路):
    try:
        return json.load(open(路, encoding="utf-8"))
    except (OSError, ValueError):
        return []


def logn同步(d):
    """app 交上来：put＝{房: [改过的整条]}，gone＝[[房, id]]，got＝克的改它拿到第几号，call＝点了 Done。
    交回去：ops＝克的新改，ok＝存下的 [房, id, updatedAt]，gone＝删掉的 [房, id]，typing＝克在不在打字。"""
    ok, 删了 = [], []
    with logn锁:
        for 房, 条们 in (d.get("put") or {}).items():
            if 房 not in LOGN_房 or not isinstance(条们, list):
                continue
            镜 = logn读(房)
            for x in 条们[:2000]:
                if not isinstance(x, dict) or not re.fullmatch(r"[A-Za-z0-9_-]{1,40}", str(x.get("id") or "")):
                    continue
                x.pop("blob", None)
                旧 = 镜.get(x["id"])
                if not 旧 or (x.get("updatedAt") or 0) >= (旧.get("updatedAt") or 0):
                    镜[x["id"]] = x
                ok.append([房, x["id"], x.get("updatedAt") or 0])
            logn写(房, 镜)
        for g in (d.get("gone") or [])[:5000]:
            if not isinstance(g, list) or len(g) != 2 or g[0] not in LOGN_房:
                continue
            镜 = logn读(g[0])
            if 镜.pop(str(g[1]), None) is not None:
                logn写(g[0], 镜)
            if g[0] in ("pics", "files"):
                logn删件(str(g[1]))
            删了.append(g)
    if d.get("call"):
        logn存(LOGN_叫, str(毫秒()))
    got = int(d.get("got") or 0)
    logn存(LOGN_收, str(got))          # 手机收到第几号：另一头加的东西到没到手机，看它
    叫 = logn叫()
    if got == 0:
        # 新手机（清了数据、换了手机）：改.json 只留 30 天，从镜子整份给一遍。号先给 0，最后一条才是现在的号：
        # 中途哪张图拿不到停下，got 还是 0，下回整份重给；全拿完才记到现在的号
        with logn锁:
            号 = logn号()
            if not 号:                  # 一次都没改过也要有个号，不然 got 一直是 0、每回都整份给
                号 = 1
                logn存(LOGN_号, "1")
            全 = [{"seq": 0, "room": 房, "op": "put", "rec": x}
                  for 房 in ("reminders", "days", "notes", "pics", "files", "messages") for x in logn读(房).values()]
        return {"ops": 全 + [{"seq": 号, "room": "-"}], "ok": ok, "gone": 删了,
                "typing": bool(叫) and 毫秒() - 叫 < 1800000}
    return {"ops": [c for c in 读json(LOGN_改) if c["seq"] > got], "ok": ok, "gone": 删了,
            "typing": bool(叫) and 毫秒() - 叫 < 1800000}


class 处理(BaseHTTPRequestHandler):
    server_version = "pyq"
    protocol_version = "HTTP/1.1"   # 连接复用。默认的 1.0 每个请求都要重做一次 TLS 握手，
                                    # 手机上发条评论要等好几秒，弱信号直接发不出去。
    timeout = 65                    # 握手后的读超时，也管空闲的 keep-alive 连接

    def log_message(self, fmt, *a):
        # 不记访问日志
        pass

    # -- 工具 --

    def 回(self, 码, 体, 型="text/html; charset=utf-8"):
        if isinstance(体, str):
            体 = 体.encode("utf-8")
        self.send_response(码)
        self.send_header("Content-Type", 型)
        self.send_header("Content-Length", str(len(体)))
        self.send_header("Cache-Control", "no-store")
        if "/logn/" in self.path:          # Logn app 的页面从手机里开（https://logn.local），要跨站来问
            self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(体)

    def 回json(self, o, 码=200):
        self.回(码, json.dumps(o, ensure_ascii=False), "application/json; charset=utf-8")

    def 送盘(self, 路, 后缀, 长缓存=False):
        if not os.path.isfile(路):
            return self.回(404, "")
        型 = {"jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png",
              "gif": "image/gif", "webp": "image/webp", "mp4": "video/mp4", "apk": "application/vnd.android.package-archive"}.get(后缀, "application/octet-stream")
        改 = self.date_time_string(int(os.path.getmtime(路)))
        if not 长缓存 and self.headers.get("If-Modified-Since") == 改:
            self.send_response(304)
            self.send_header("Last-Modified", 改)
            self.send_header("Content-Length", "0")
            self.end_headers()
            return
        self.send_response(200)
        self.send_header("Content-Type", 型)
        self.send_header("Content-Length", str(os.path.getsize(路)))
        if "/logn/" in self.path:          # Logn app 跨站来拿图
            self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "max-age=31536000" if 长缓存 else "no-cache")
        self.send_header("Last-Modified", 改)
        self.end_headers()
        # 一次只拿 64KB，整张图不进内存
        with open(路, "rb") as f:
            while True:
                块 = f.read(CHUNK)
                if not 块:
                    break
                self.wfile.write(块)

    def 收logn件(self):
        q = urlsplit(self.path).query
        id = (re.search(r"(?:^|&)id=([A-Za-z0-9_-]{1,40})(?:&|$)", q) or [None, None])[1]
        后 = (re.search(r"(?:^|&)ext=([a-z0-9]{1,8})(?:&|$)", q) or [None, "bin"])[1]
        n = int(self.headers.get("Content-Length") or 0)
        if not id or n <= 0 or n > 210 * 1024 * 1024:
            self.close_connection = True
            return self.回(400, "")
        os.makedirs(LOGN_件, exist_ok=True)
        logn删件(id)
        路 = os.path.join(LOGN_件, id + "." + 后)
        剩 = n
        with open(路 + ".tmp", "wb") as f:
            while 剩 > 0:
                块 = self.rfile.read(min(CHUNK, 剩))
                if not 块:
                    break
                f.write(块)
                剩 -= len(块)
        if 剩:
            os.remove(路 + ".tmp")
            self.close_connection = True
            return self.回(400, "")
        os.replace(路 + ".tmp", 路)
        return self.回json({"ok": id})

    def 收json(self):
        n = int(self.headers.get("Content-Length") or 0)
        if n <= 0:
            return {}
        if n > 64 * 1024 * 1024:
            self.close_connection = True   # 太大就不读了，这条连接也别再用
            return {}
        try:
            return json.loads(self.rfile.read(n).decode("utf-8"))
        except Exception:
            return {}

    def 路(self):
        p = unquote(urlsplit(self.path).path)
        if not p.startswith(前缀()):
            return None
        剩 = p[len(前缀()):]
        return 剩 if 剩.startswith("/") else ("/" + 剩 if 剩 == "" else None)

    # -- GET --

    def do_GET(self):
        r = self.路()
        if r is None:
            return self.回(404, "")
        if r == "/logn/peek":              # Logn 在后台时来问：after 号以后克有几句新话（只问不拿）
            logn存(LOGN_问, str(毫秒()))     # 记下手机最近一次在后台来问的时间：看得出后台通知通不通
            m = re.search(r"(?:^|&)after=(\d+)", urlsplit(self.path).query)
            after = int(m.group(1)) if m else 0
            新 = [c for c in 读json(LOGN_改) if c["seq"] > after and c["room"] == "messages" and c["op"] == "put" and c["rec"].get("by") == "ke"]
            话 = lambda x: x.get("text") or (x.get("card") or {}).get("title") or "Photo"
            return self.回json({"n": len(新), "last": 新[-1]["seq"] if 新 else after, "text": 话(新[-1]["rec"]) if 新 else ""})

        if r.startswith("/logn/blob/"):    # 克发的图、文件，app 来拿
            路 = logn件路(r[len("/logn/blob/"):])
            return self.送盘(路, 路.rsplit(".", 1)[-1]) if 路 else self.回(404, "")
        return self.回(404, "")

    def do_POST(self):
        if self.路() == "/logn/blob":   # 交图、文件：原始字节，边收边写盘
            return self.收logn件()
        d = self.收json()   # 先把 body 收干净：keep-alive 下漏读会串进下一个请求
        if self.路() == "/logn/sync":
            return self.回json(logn同步(d))
        return self.回(404, "")

    # Logn app 跨站来问之前先探一下
    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Max-Age", "86400")
        self.send_header("Content-Length", "0")
        self.end_headers()


握手超时 = 20          # 连上来不说话的，20 秒自己断


class 服务(ThreadingHTTPServer):
    def handle_error(self, request, client_address):
        # 对面拔线、超时、握手不成——都不是这边的错，别往日志里刷 traceback。
        # 真出别的岔子还是照打。
        if not isinstance(sys.exc_info()[1], (ConnectionError, TimeoutError, ssl.SSLError)):
            super().handle_error(request, client_address)


class 加密服务(服务):
    """TLS 握手放到每个连接自己的线程里做。

    原来是 wrap_socket(监听 socket)，握手就发生在主线程的 accept() 里：
    外网来一个连上不说话的（扫端口的天天有），accept 一直堵着，
    整个服务谁都进不来。2026-09-01 这么卡死过一次。
    """

    def get_request(self):
        conn, addr = self.socket.accept()      # 只收裸连接，不握手
        conn.settimeout(握手超时)
        return conn, addr

    def process_request_thread(self, request, client_address):
        try:
            request = self.ctx.wrap_socket(request, server_side=True)
        except (OSError, ssl.SSLError):
            self.shutdown_request(request)     # 握手不成就安静地关掉
            return
        super().process_request_thread(request, client_address)


def 起(端口, 加密=False):
    srv = (加密服务 if 加密 else 服务)(("0.0.0.0", 端口), 处理)
    srv.加密 = 加密
    if 加密:
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.load_cert_chain(CERT, KEY)
        srv.ctx = ctx
    return srv


if __name__ == "__main__":
    加密 = bool(CERT and KEY)
    print("Logn server: %s://<host>:%d/%s   data: %s" % ("https" if 加密 else "http", PORT, TOKEN, DIR), flush=True)
    起(PORT, 加密=加密).serve_forever()
