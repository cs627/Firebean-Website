#!/bin/bash
# fb-nasnet.sh — 直接電纜接 NAS：臨時把 iMac 拉去 NAS 網段做修復
# 只喺 macOS 上跑。用法： bash ~/fb-net.sh
# 只改 iMac 自己嘅網絡設定，NAS 一個 byte 都唔會碰；跑完自動還原。
VERSION="fb-net2-20261031-2040"
set -u

NAS_IP="${NAS_IP:-192.168.1.200}"
TMP_IP="${TMP_IP:-192.168.1.99}"
WIFI_DEV="${WIFI_DEV:-en1}"
ETH_DEV="en0"

echo "=================================================="
echo "  Firebean NAS 網絡接駁工具   ${VERSION}"
echo "=================================================="

die() { echo "❌ $*"; exit 1; }

# ---------- 0. 跑錯機自我識別 ----------
if [ "$(uname -s)" != "Darwin" ]; then
  echo "❌ 呢個工具要喺 **Mac** 上面跑（唔係 NAS、唔係 Linux）。"
  echo "   正確做法：打開 iMac 嘅 Terminal，貼： bash ~/fb-net.sh"
  exit 2
fi

# ---------- 1. 搵 en0 對應嘅 network service 名 ----------
SVC="$(networksetup -listnetworkserviceorder 2>/dev/null | awk '
  /^\([0-9]+\) /{ n=$0; sub(/^\([0-9]+\) /,"",n) }
  /Device: '"$ETH_DEV"'\)/{ print n; exit }')"
[ -n "$SVC" ] || die "搵唔到 ${ETH_DEV} 對應嘅網絡服務名。請貼 networksetup -listnetworkserviceorder 嘅輸出畀我。"
echo "✅ 有線服務名：${SVC}  (${ETH_DEV})"

echo
echo "--- 現況 ---"
ifconfig "$ETH_DEV" 2>/dev/null | grep -E "status|inet " || true
netstat -rn -f inet 2>/dev/null | grep "^default" || true

# ---------- 2. 熄 Wi-Fi ----------
echo
echo "--- 熄 Wi-Fi（會暫時斷網約 2 分鐘，唔熄 macOS 會封住 en0 同一網段嘅路由）---"
if networksetup -setairportpower "$WIFI_DEV" off 2>/dev/null; then
  echo "✅ Wi-Fi 已熄"
else
  echo "⚠️ 熄 Wi-Fi 失敗（可能已經熄咗 / 唔叫 ${WIFI_DEV}），繼續。"
fi
sleep 2

# ---------- 3. 三種方法順序試，試到通為止 ----------
can_reach() {
  nc -z -G 5 "$NAS_IP" 5000 2>/dev/null && return 0
  nc -z -G 5 "$NAS_IP" 5001 2>/dev/null && return 0
  return 1
}
show_net() {
  ifconfig "$ETH_DEV" 2>/dev/null | grep "inet " | sed 's/^/     /' || true
  if netstat -rn -f inet 2>/dev/null | grep -q "192\.168\.1"; then
    netstat -rn -f inet | grep "192\.168\.1" | sed 's/^/     /'
  else
    echo "     ⚠️ 路由表冇 192.168.1"
  fi
}

OK=0
N=0
while IFS='|' read -r label cmd; do
  [ -n "$label" ] || continue
  N=$((N + 1))
  echo
  echo "--- 方法 ${N}：${label} ---"
  eval "$cmd" >/dev/null 2>&1 || true
  sleep 3
  show_net
  if can_reach; then
    echo "   ✅ 通咗（方法 ${N}）"
    OK=1
    break
  fi
  echo "   ❌ 未通"
done <<CMDS
networksetup 設定 ${ETH_DEV} = ${TMP_IP}/24|sudo networksetup -setmanual "${SVC}" "${TMP_IP}" 255.255.255.0
ifconfig alias ${TMP_IP}|sudo ifconfig ${ETH_DEV} alias ${TMP_IP} 255.255.255.0
手動加路由 via ${ETH_DEV}|sudo route add -net 192.168.1.0/24 -interface ${ETH_DEV}
CMDS

# ---------- 4. 唔通就掃晒成個 /24 ----------
if [ "$OK" != "1" ]; then
  echo
  echo "--- 掃描整個 192.168.1.0/24 嘅 5000 port（約 10 秒）---"
  for i in $(seq 1 254); do
    ( nc -z -G 1 "192.168.1.$i" 5000 2>/dev/null && echo "✅ 搵到 NAS → 192.168.1.$i" ) &
  done
  wait
  echo "--- 掃描完 ---"
fi

# ---------- 5. 開 DSM 或出診斷 ----------
echo
if [ "$OK" = "1" ]; then
  echo "🎉 DSM 通咗，正幫你開 Safari…"
  open "http://${NAS_IP}:5000"
else
  echo "⚠️ 三種方法都未通。以下係診斷資料，請連同上面全部一齊貼返畀我："
  echo "--- ifconfig ${ETH_DEV} ---"; ifconfig "$ETH_DEV" 2>/dev/null
  echo "--- ARP ---";    arp -an -i "$ETH_DEV" 2>/dev/null | head -10
  echo "--- ROUTES ---"; netstat -rn -f inet 2>/dev/null | head -14
fi

# ---------- 6. 等用戶改完 DSM，然後還原 ----------
echo
echo "=================================================="
echo "▶ 如果 Safari 開到 DSM："
echo "   登入 → Control Panel → Network → Network Interface → LAN → Edit"
echo "   → 選 Manual → IP 169.254.71.131 / Subnet 255.255.0.0 / Gateway 留空 → Apply"
echo "   （彈「連線會中斷」係正常，確認就得）"
echo
echo "▶ 改完就返嚟呢個窗，按一下 Enter 收尾（自動還原網絡 + 開返 Wi-Fi）。"
echo "   未改到都照按 Enter，唔會壞任何嘢。"
echo "=================================================="
read -r _

echo
echo "--- 還原 ${ETH_DEV} = 自動取得 ---"
sudo networksetup -setdhcp "$SVC" || true
sleep 3
ifconfig "$ETH_DEV" 2>/dev/null | grep "inet " || echo "（${ETH_DEV} 自動取得中，稍後會出現 169.254.x.x）"
echo "--- 開返 Wi-Fi ---"
if networksetup -setairportpower "$WIFI_DEV" on 2>/dev/null; then
  echo "✅ Wi-Fi 已開返"
else
  echo "⚠️ 開 Wi-Fi 失敗，請喺右上角手動開返。"
fi
echo
echo "✅ 收尾完成（${VERSION}）"
