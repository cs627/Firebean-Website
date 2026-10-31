#!/usr/bin/env bash
# ============================================================================
#  fb-arplmenu.sh  —  一鍵搵出 Xpenology 引導（ARPL / RR / GXNAS）嘅管理端口
#                     並自動強制佢跳入引導菜單
#
#  點解要用：引導「直接啟動」時，菜單只出現 1 秒，鍵盤幾乎一定搶唔到。
#           但只要喺開機期間有人連佢嘅 7681 端口，引導就會【中止 DSM 啟動、
#           跳入管理菜單】。呢個腳本就不停幫你連，一擊即中。
#
#  用法（iMac Terminal 貼一行）：
#      bash ~/fb-arplmenu.sh
#
#  想指定網段（例如唔係 192.168.1.x）：
#      bash ~/fb-arplmenu.sh 192.168.0
# ============================================================================
set -u

VERSION="fb-arplmenu-20261031-2200"
SUBNET="${1:-192.168.1}"
MINUTES="${2:-12}"
PORT_LOADER=7681      # ARPL / RR 引導管理界面 (ttyd)
PORT_DSM=5000         # DSM 主界面
MAX=$(( MINUTES * 60 ))

C_R=$'\033[31m'; C_G=$'\033[32m'; C_Y=$'\033[33m'; C_B=$'\033[36m'; C_0=$'\033[0m'

say()  { printf '%s\n' "$*"; }
hr()   { printf '%s\n' "────────────────────────────────────────────────────────"; }

hr
say "${C_B}  fb-arplmenu.sh  ${VERSION}${C_0}"
say "  目標網段：${SUBNET}.0/24"
say "  最多監聽：${MINUTES} 分鐘"
hr
say ""
say "  腳本會不停掃描，直到搵到引導嘅管理界面為止。"
say ""
say "  ${C_Y}你而家做：${C_0}"
say "    ① 部 NAS 網線插落 office router 嘅 LAN port"
say "    ② 部 NAS 開機（或重啟）"
say "    ③ 唔好關呢個 Terminal 窗口，等佢自動中"
say ""

# ── 掃描一個端口，搵出有回應嘅 IP ──────────────────────────────────────────
scan_port() {
  local port="$1"
  seq 1 254 \
    | xargs -P 254 -I{} sh -c '
        ip="'"${SUBNET}"'.{}"
        code=$(curl -s -m 0.35 -o /dev/null -w "%{http_code}" "http://${ip}:'"${port}"'/" 2>/dev/null)
        if [ -n "$code" ] && [ "$code" != "000" ]; then
          printf "%s\n" "$ip"
        fi
      ' 2>/dev/null
}

# ── 找到引導後：狂敲 7681 迫佢入菜單 ────────────────────────────────────────
force_menu() {
  local ip="$1"
  say ""
  hr
  say "${C_G}  ★ 搵到引導管理界面：http://${ip}:${PORT_LOADER}${C_0}"
  hr
  say ""
  say "  正在自動幫你敲端口（迫引導停低入菜單）…"
  open "http://${ip}:${PORT_LOADER}" 2>/dev/null || true
  local i=0
  while [ "$i" -lt 60 ]; do
    curl -s -m 1 -o /dev/null "http://${ip}:${PORT_LOADER}/" 2>/dev/null || true
    i=$(( i + 1 ))
    sleep 0.4
  done
  say "  ${C_G}✅ 已經幫你敲咗 24 秒${C_0}"
  say ""
  say "  ${C_Y}而家睇 iMac 上面啱啱彈出嘅 Safari：${C_0}"
  say "    → 如果見到【引導菜單】= 成功！影相"
  say "    → 如果空白 / 連唔到 = 引導已經跳去 DSM 啟動，等佢開完機再重啟一次"
  say ""
  say "  ${C_Y}Safari 開唔到就手動試：${C_0}"
  say "    http://${ip}:${PORT_LOADER}"
  say ""
}

# ── 主循環 ─────────────────────────────────────────────────────────────────
START=$(date +%s)
ROUND=0
FOUND=""
DSM_SEEN=""

while :; do
  NOW=$(date +%s)
  [ $(( NOW - START )) -ge "$MAX" ] && break
  ROUND=$(( ROUND + 1 ))

  printf '\r  [第 %d 次掃描] 搵緊引導端口 %s …   ' "$ROUND" "$PORT_LOADER"

  HIT=$(scan_port "$PORT_LOADER" | head -1)

  if [ -n "$HIT" ]; then
    printf '\r%*s\r' 60 ''
    FOUND="$HIT"
    force_menu "$HIT"
    # 引導入咗菜單就會長開 7681；呢個時候唔使再掃，等用戶操作
    say "  （腳本已完成任務，你可以收工去按菜單）"
    say ""
    break
  fi

  # 順手報告 DSM 係唔係已經開咗（代表引導已經跳過咗）—— 每 5 圈先查一次
  if [ -z "$DSM_SEEN" ] && [ $(( ROUND % 5 )) -eq 0 ]; then
    D=$(scan_port "$PORT_DSM" | head -1)
    if [ -n "$D" ]; then
      DSM_SEEN="$D"
      printf '\r%*s\r' 60 ''
      say "  ${C_Y}ℹ️  見到 DSM 已經開咗：http://${D}:5000${C_0}"
      say "     → 代表引導今次已經跳過菜單。唔緊要，${C_Y}重啟部 NAS${C_0} 再嚟過，"
      say "       腳本會繼續幫你敲。"
      say ""
    fi
  fi

  sleep 0.3
done

printf '\r%*s\r' 60 ''
hr
if [ -n "$FOUND" ]; then
  say "  ${C_G}結果：已搵到引導菜單入口 http://${FOUND}:${PORT_LOADER}${C_0}"
else
  say "  ${C_R}掃咗 ${MINUTES} 分鐘都搵唔到引導嘅 ${PORT_LOADER} 端口。${C_0}"
  say ""
  say "  請確認："
  say "    ① NAS 網線真係插咗落 router（唔係 iMac）"
  say "    ② NAS 有開機、router 燈有閃"
  say "    ③ 網段真係 ${SUBNET}.x"
  say ""
  say "  再試：bash ~/fb-arplmenu.sh ${SUBNET} 15"
fi
hr
