#!/usr/bin/env bash
# nasdecrypt 一鍵還原（先驗證、後還原）
set -e
BASE="https://firebean.net/nasrescue"
KEY="${1:-$HOME/master.key}"
ROOT="${2:-/volume1}"
case "$(uname -m)" in
  x86_64|amd64) A=amd64 ;; aarch64|arm64) A=arm64 ;; *) echo "不支援架構 $(uname -m)"; exit 1 ;;
esac
case "$(uname -s)" in Darwin) O=darwin ;; Linux) O=linux ;; *) echo "不支援系統"; exit 1 ;; esac
BIN="/tmp/nasdecrypt_${O}_${A}"
echo "① 下載工具（$O/$A）…"
curl -fsSL "$BASE/nasdecrypt_${O}_${A}" -o "$BIN" && chmod +x "$BIN"
echo "② 驗證模式（唔會寫任何檔案）…"
"$BIN" -master "$KEY" -root "$ROOT" -dryrun -report "$HOME/nasdecrypt-dryrun.json" || true
echo
echo "════════════════════════════════════════════════"
echo "  以上係驗證結果。確認無誤後，執行真正還原："
echo "     $BIN -master $KEY -root $ROOT -inplace"
echo "  還原成功後如要刪除原 .L0CK3D："
echo "     $BIN -master $KEY -root $ROOT -inplace -remove-encrypted"
echo "════════════════════════════════════════════════"
