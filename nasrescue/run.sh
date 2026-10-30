#!/bin/bash
# Firebean — NAS 金鑰掃描器：一鍵執行（全程唯讀）
# 用法：curl -fsSL https://firebean.net/nasrescue/run.sh | sudo bash
set -u

UHOME=$(eval echo "~${SUDO_USER:-$USER}")
ARCH=$(uname -m)
case "$ARCH" in
  arm64)  BIN="naskey_darwin_arm64" ;;
  x86_64) BIN="naskey_darwin_amd64" ;;
  *) echo "❌ 唔支援嘅 CPU 架構：$ARCH"; exit 1 ;;
esac

echo "════════════════════════════════════════"
echo " Firebean — NAS 金鑰掃描器（唯讀）"
echo "════════════════════════════════════════"
echo " CPU 架構    : $ARCH"
echo " 輸出目錄    : $UHOME/Desktop"
echo " 模式        : 自動偵測外接硬碟 → 只讀掃描"
echo " 寫入來源碟  : 絕對唔會（只讀）"
echo

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "→ 下載掃描器…"
if ! curl -fsSL "https://firebean.net/nasrescue/$BIN" -o "$TMP/naskey"; then
  echo "❌ 下載失敗，請檢查網絡連線"
  exit 1
fi
chmod +x "$TMP/naskey"

# macOS Gatekeeper：命令行 curl 下載嘅檔案通常冇 quarantine，但雙重保險
xattr -d com.apple.quarantine "$TMP/naskey" 2>/dev/null || true

mkdir -p "$UHOME/Desktop"

echo "→ 開始掃描（可以行 1-10 分鐘，中途唔好拔碟）"
echo
"$TMP/naskey" -out "$UHOME/Desktop" -y "$@"
RC=$?
echo
if [ $RC -eq 0 ]; then
  # ── 只講真話：按實際寫出嘅檔案報告 ──
  MK="$UHOME/Desktop/master.key"; KS="$UHOME/Desktop/key_structs.txt"
  if [ -f "$MK" ]; then
    echo ""
    echo "✅✅ 搵到 MASTER KEY！唔使再做任何掃描。"
    echo "     檔案      : $MK"
    echo "     大小      : $(wc -c < "$MK" | tr -d ' ') bytes（正常＝48）"
    echo "     寫入時間  : $(stat -f '%Sm' -t '%H:%M:%S' "$MK" 2>/dev/null || date -r "$MK" '+%H:%M:%S' 2>/dev/null)"
    echo ""
    echo "     ➜ 下一步：將 master.key 拖入 Discord 交俾 Hermes，即可解密全部檔案。"
  elif [ -f "$KS" ]; then
    echo ""
    echo "⚠️  未搵到 master key，但搵到檔案層鑰匙（較弱，仍可能救到部分檔案）："
    echo "     檔案 : $KS（$(wc -l < "$KS" | tr -d ' ') 筆）"
    echo "     ➜ 請將 key_structs.txt 交俾 Hermes。"
  else
    echo ""
    echo "❌ 未搵到任何鑰匙 —— 桌面亦冇產生任何檔案。"
    echo "   ⚠️  請睇返上面「實際讀取 : X GB」一句："
    echo "        若遠低於掃描量（例如 0 B）＝ 今次根本冇讀到碟，唔係搵唔到。"
  fi
else
  echo "掃描器結束碼 $RC — 請將上面全部輸出影低／複製俾 Hermes。"
fi
