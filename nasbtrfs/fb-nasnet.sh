#!/bin/bash
# fb-nasnet.sh — 直連電纜接 NAS，並把 NAS + iMac 轉去一個唔會同 Wi-Fi 撞嘅專用網段
# 只喺 macOS 上跑。用法： bash ~/fb-net.sh
# 只改 iMac 自己嘅網絡設定，NAS 一個 byte 都唔會碰。
VERSION="fb-net3-20261031-2115"
set -u

NAS_IP="${NAS_IP:-169.254.71.131}"      # DSM 而家應該喺呢度
NEW_NAS_IP="${NEW_NAS_IP:-10.0.0.1}"    # 建議改去呢個（同 Wi-Fi 完全唔同網段）
NEW_MAC_IP="${NEW_MAC_IP:-10.0.0.2}"
LEGACY_IP="192.168.1.200"
LEGACY_MAC_IP="192.168.1.99"
WIFI_DEV="${WIFI_DEV:-en1}"
ETH_DEV="en0"

echo "=================================================="
echo "  Firebean NAS 接駁 + 網段遷移   ${VERSION}"
echo "=================================================="

die() { echo "❌ $*"; exit 1; }

if [ "$(uname -s)" != "Darwin" ]; then
  echo "❌ 呢個工具要喺 **Mac** 上面跑（唔係 NAS、唔係 Linux）。"
  exit 2
fi

SVC="$(networksetup -listnetworkserviceorder 2>/dev/null | awk '
  /^\([0-9]+\) /{ n=$0; sub(/^\([0-9]+\) /,"",n) }
  /Device: '"$ETH_DEV"'\)/{ print n; exit }')"
[ -n "$SVC" ] || die "搵唔到 ${ETH_DEV} 嘅網絡服務名。"
echo "✅ 有線服務名：${SVC}  (${ETH_DEV})"

echo
echo "--- 現況 ---"
ifconfig "$ETH_DEV" 2>/dev/null | grep -E "status|inet " || true

echo
echo "--- 熄 Wi-Fi（斷網約 3 分鐘，跑完自動開返）---"
echo "    原因：Wi-Fi 自己都有一個 169.254 位址，唔熄佢 macOS 會將 link-local 封包全部送咗去 Wi-Fi。"
networksetup -setairportpower "$WIFI_DEV" off 2>/dev/null && echo "✅ Wi-Fi 已熄" || echo "⚠️ 熄 Wi-Fi 失敗，繼續"
sleep 2

echo
echo "--- 清走之前殘留嘅假路由 ---"
sudo route -n delete -host "$NAS_IP"    >/dev/null 2>&1 || true
sudo route -n delete -host "$LEGACY_IP" >/dev/null 2>&1 || true
sudo arp -d "$NAS_IP"    >/dev/null 2>&1 || true
sudo arp -d "$LEGACY_IP" >/dev/null 2>&1 || true

can_reach() { nc -z -G 5 "$1" "$2" 2>/dev/null; }

FOUND=""
echo
echo "--- 方法 A：試 ${NAS_IP} ---"
ifconfig "$ETH_DEV" 2>/dev/null | grep "inet " | sed 's/^/     /' || true
for P in 5000 5001; do
  if can_reach "$NAS_IP" "$P"; then echo "   ✅ 通！ ${NAS_IP}:${P}"; FOUND="$NAS_IP"; break; else echo "   ❌ ${NAS_IP}:${P}"; fi
done

if [ -z "$FOUND" ]; then
  echo
  echo "--- 方法 B：試返舊 IP ${LEGACY_IP}（en0 = ${LEGACY_MAC_IP}/24）---"
  sudo networksetup -setmanual "$SVC" "$LEGACY_MAC_IP" 255.255.255.0 >/dev/null 2>&1 || true
  sleep 3
  ifconfig "$ETH_DEV" 2>/dev/null | grep "inet " | sed 's/^/     /' || true
  for P in 5000 5001; do
    if can_reach "$LEGACY_IP" "$P"; then echo "   ✅ 通！ ${LEGACY_IP}:${P}"; FOUND="$LEGACY_IP"; break; else echo "   ❌ ${LEGACY_IP}:${P}"; fi
  done
  if [ -z "$FOUND" ]; then
    echo "   ↩️ 還原 ${ETH_DEV} 去自動取得"
    sudo networksetup -setdhcp "$SVC" >/dev/null 2>&1 || true
    sleep 3
  fi
fi

# ---------- 都唔通：聽 15 秒，睇下 NAS 自己講咩 ----------
if [ -z "$FOUND" ]; then
  echo
  echo "--- 方法 C：聽 ${ETH_DEV} 上嘅廣播 15 秒，搵 NAS 真身 ---"
  CAP=/tmp/fb-nasnet-cap.txt
  sudo rm -f "$CAP"
  ( sudo tcpdump -i "$ETH_DEV" -ne -c 150 > "$CAP" 2>&1 & )
  sleep 15
  sudo pkill -x tcpdump >/dev/null 2>&1 || true
  sleep 1
  if [ -s "$CAP" ]; then
    echo "   --- 出現過嘅 MAC ---"
    awk 'NR>2 && /[0-9a-f]{2}:/{print $2}' "$CAP" | sort | uniq -c | sort -rn | head -6 | sed 's/^/     /'
    echo "   --- ARP ---"
    grep -a "who-has" "$CAP" | head -6 | sed 's/^/     /'
  else
    echo "     （15 秒內冇任何封包 —— 可能線鬆、NAS 熄咗、或 NAS 完全靜音）"
  fi
fi

# ---------- 都唔通：收工 + 診斷 ----------
if [ -z "$FOUND" ]; then
  echo
  echo "⚠️ 三個方法都未通。診斷資料如下，請全部貼返畀我："
  echo "--- ifconfig ${ETH_DEV} ---"; ifconfig "$ETH_DEV" 2>/dev/null
  echo "--- ARP ---";    arp -an -i "$ETH_DEV" 2>/dev/null | head -10
  echo "--- ROUTES ---"; netstat -rn -f inet 2>/dev/null | head -16
  echo
  echo "--- 開返 Wi-Fi ---"
  networksetup -setairportpower "$WIFI_DEV" on 2>/dev/null && echo "✅ Wi-Fi 已開返" || echo "⚠️ 請手動開返 Wi-Fi"
  echo "✅ 完成（未能接上，${VERSION}）"
  exit 1
fi

echo
echo "🎉 接上咗（${FOUND}），正幫你開 Safari…"
open "http://${FOUND}:5000"

echo
echo "=================================================="
echo "▶ 喺 Safari 嘅 DSM 入面，做呢一步（唯一一步）："
echo "   Control Panel → Network → Network Interface → LAN → Edit"
echo "   → Use manual configuration"
echo "        IP address    ${NEW_NAS_IP}"
echo "        Subnet mask   255.255.255.0"
echo "        Gateway       （留空，唔好填）"
echo "        DNS           （留空）"
echo "   → Apply → 彈「連線會中斷」→ 確認"
echo
echo "   為咩要改：iMac 嘅 Wi-Fi 自己都有 169.254 位址，兩個網卡永遠爭同一段路。"
echo "   改去 ${NEW_NAS_IP} 之後就一世唔會再撞。"
echo
echo "▶ 改完返嚟呢個窗，按一下 Enter。"
echo "   腳本會將 ${ETH_DEV} 設為 ${NEW_MAC_IP}/24（唔用 DHCP、唔用 169.254）+ 開返 Wi-Fi，"
echo "   以後一插線就通，Wi-Fi 同時照用。"
echo "   未改到都照按 Enter，腳本會自動還原。"
echo "=================================================="
read -r _

echo
echo "--- 設定 ${ETH_DEV} = ${NEW_MAC_IP}/24 ---"
sudo networksetup -setmanual "$SVC" "$NEW_MAC_IP" 255.255.255.0 >/dev/null 2>&1 || true
sleep 3
ifconfig "$ETH_DEV" 2>/dev/null | grep "inet " | sed 's/^/     /' || true

echo "--- 開返 Wi-Fi ---"
networksetup -setairportpower "$WIFI_DEV" on 2>/dev/null && echo "✅ Wi-Fi 已開返" || echo "⚠️ 請手動開返 Wi-Fi"
sleep 3

echo "--- 驗證最終狀態 ---"
FINAL=0
for P in 5000 5001; do
  if can_reach "$NEW_NAS_IP" "$P"; then echo "✅ 通！ http://${NEW_NAS_IP}:${P}"; FINAL=1; break; else echo "❌ ${NEW_NAS_IP}:${P}"; fi
done

if [ "$FINAL" = "1" ]; then
  echo
  echo "🎉🎉 搞掂！DSM 以後都喺  http://${NEW_NAS_IP}:5000"
  echo "   Wi-Fi 照用、NAS 照連，兩邊唔會再打架。"
else
  echo
  echo "⚠️ 新網段未通 —— 大機會係 DSM 嗰步未成功改到 ${NEW_NAS_IP}。"
  echo "   腳本還原 ${ETH_DEV} 去自動取得。"
  sudo networksetup -setdhcp "$SVC" >/dev/null 2>&1 || true
  sleep 2
  ifconfig "$ETH_DEV" 2>/dev/null | grep "inet " | sed 's/^/     /' || true
fi
echo
echo "✅ 收尾完成（${VERSION}）"
