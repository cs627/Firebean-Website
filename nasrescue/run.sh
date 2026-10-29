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
  echo "完成。結果已放喺 $UHOME/Desktop/（master.key / key_structs.txt）"
else
  echo "掃描器結束碼 $RC — 請將上面全部輸出影低／複製俾 Hermes。"
fi
