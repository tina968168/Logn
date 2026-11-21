#!/usr/bin/env python3
"""监听：手机上点了 Chat 右上的按钮（Clawd）就打一行字。给 Claude Code 的 Monitor 用：每打一行，cc 就被叫醒。
用法：LOGN_DIR=<跟服务器同一个数据目录> python3 listen.py"""
import os, time
档 = os.path.join(os.path.abspath(os.environ.get("LOGN_DIR") or "logn-data"), "叫克")
def 叫():
    try: return open(档).read().strip()
    except OSError: return ""
上 = 叫()          # `logn -多` 发的时候会把同一个数放回去，同一个数不算又点了
while True:
    time.sleep(2)
    现 = 叫()
    if 现 and 现 != 上:
        print("Logn: 对方点了 Done，用 logn 看、回", flush=True)
    if 现:
        上 = 现
