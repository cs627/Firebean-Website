#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  fb-nasbak.sh 離線 mock 測試（唔會真複製、唔會連 NAS）
#
#  • 用假 /Volumes 目錄 + 假 mount 輸出（macOS 格式）驅動被測腳本
#  • 驗證六點：
#      1. 未知子命令 → 印「冇呢個任務」＋清單＋exit 2
#      2. 來源不存在 → 報錯（提及來源）＋非零結束
#      3. 目的地等於來源 → 拒絕
#      4. 目的地係來源子目錄 → 拒絕
#      5. 目的地係本機碟 → 警告（非互動時唔自動前進）
#      6. 腳本內絕對冇 rsync 刪除旗標（唔會雙向同步）
#
#  用法：bash fb-nasbak.mocktest.sh [被測腳本路徑]
# ═══════════════════════════════════════════════════════════════
set -u

SUT="${1:-$(dirname "$0")/fb-nasbak.sh}"
SUT="$(cd "$(dirname "$SUT")" && pwd)/$(basename "$SUT")"
if [ ! -f "$SUT" ]; then
  echo "搵唔到被測腳本：$SUT"
  exit 1
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# ── 假 /Volumes 目錄結構 ───────────────────────────────────────
VOL="$TMP/Volumes"
mkdir -p "$VOL/ExternalSSD/dicksonimac/recovered"
mkdir -p "$VOL/Macintosh HD"
mkdir -p "$VOL/NewNAS"
mkdir -p "$VOL/LocalDisk"
echo "救回嘅資料一" > "$VOL/ExternalSSD/dicksonimac/recovered/a.txt"
echo "救回嘅資料二" > "$VOL/ExternalSSD/dicksonimac/recovered/b.txt"

# ── 假 mount 輸出（macOS 格式：來源 on 掛載點 (fstype, opts)）──
MOUNT_F="$TMP/mount.txt"
cat > "$MOUNT_F" <<EOF
/dev/disk2s1 on $VOL/ExternalSSD (apfs, local, read-only, journaled)
/dev/disk1s1 on $VOL/Macintosh HD (apfs, local, journaled)
//dickson@newnas._afpovertcp._tcp.local/Backup on $VOL/NewNAS (afpfs, nodev, nosuid)
/dev/disk5s1 on $VOL/LocalDisk (apfs, local, journaled)
EOF

# 每個測試獨立 HOME（隔離記錄檔）
HOME_BASE="$TMP/home"

# 被測腳本需要嘅環境（全部指向假目錄；FB_ALLOW_NONMAC 係 Linux 上跑 mock 用）
run_sut() {
  local h="$1"; shift
  mkdir -p "$h"
  env HOME="$h" \
      FB_ALLOW_NONMAC=1 \
      FB_VOLUMES_DIR="$VOL" \
      FB_MOUNT_FILE="$MOUNT_F" \
      FB_EXTERNAL_DISK="$VOL/ExternalSSD" \
      FB_SRC_CANON="$VOL/ExternalSSD/dicksonimac/recovered" \
      FB_SRC_DEFAULT="$VOL/ExternalSSD/dicksonimac/recovered" \
      FB_LOGDIR="$h/fb-nasbak-logs" \
      bash "$SUT" "$@"
}

PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); printf '  ✅ %s\n' "$1"; }
bad() { FAIL=$((FAIL+1)); printf '  ❌ %s\n      %s\n' "$1" "${2:-}"; }

echo "════════════════════════════════════════════════════"
echo "  fb-nasbak.sh mock 測試"
echo "  被測：$SUT"
echo "════════════════════════════════════════════════════"

REC="$VOL/ExternalSSD/dicksonimac/recovered"

# ── 測試 1：未知子命令 ──────────────────────────────────────
OUT=$(run_sut "$HOME_BASE/h1" frobnicate 2>&1); RC=$?
if [ "$RC" = "2" ] && printf '%s' "$OUT" | grep -q '冇呢個任務' && printf '%s' "$OUT" | grep -q 'list / start / status / check / stop'; then
  ok "未知子命令 → 印「冇呢個任務」＋可用清單＋exit 2"
else
  bad "未知子命令行為唔啱" "RC=$RC OUT=$(printf '%s' "$OUT" | head -3)"
fi

# ── 測試 2：來源不存在 ──────────────────────────────────────
OUT=$(run_sut "$HOME_BASE/h2" start "$VOL/NewNAS/backup" "$TMP/冇呢個來源" 2>&1); RC=$?
if [ "$RC" != "0" ] && printf '%s' "$OUT" | grep -q '來源必須存在'; then
  ok "來源不存在 → 印「來源必須存在」＋非零結束（RC=$RC）"
else
  bad "來源不存在行為唔啱" "RC=$RC OUT=$(printf '%s' "$OUT" | grep '來源' | head -1)"
fi

# ── 測試 3：目的地等於來源 ──────────────────────────────────
OUT=$(run_sut "$HOME_BASE/h3" start "$REC" "$REC" 2>&1); RC=$?
if [ "$RC" = "2" ] && printf '%s' "$OUT" | grep -q '唔可以等於來源'; then
  ok "目的地等於來源 → 拒絕＋exit 2"
else
  bad "目的地等於來源行為唔啱" "RC=$RC OUT=$(printf '%s' "$OUT" | grep -i '拒絕\|來源' | head -1)"
fi

# ── 測試 4：目的地係來源子目錄 ──────────────────────────────
OUT=$(run_sut "$HOME_BASE/h4" start "$REC/sub" "$REC" 2>&1); RC=$?
if [ "$RC" = "2" ] && printf '%s' "$OUT" | grep -q '子目錄'; then
  ok "目的地係來源子目錄 → 拒絕＋exit 2"
else
  bad "目的地子目錄行為唔啱" "RC=$RC OUT=$(printf '%s' "$OUT" | grep -i '拒絕\|子目錄' | head -1)"
fi

# ── 測試 5：目的地係本機碟 → 警告（非互動唔自動前進）───────
OUT=$(printf '' | run_sut "$HOME_BASE/h5" start "$VOL/LocalDisk/backup" "$REC" 2>&1); RC=$?
if [ "$RC" != "0" ] && printf '%s' "$OUT" | grep -q '本機碟' && printf '%s' "$OUT" | grep -q '非互動\|唔會自動前進'; then
  ok "目的地係本機碟 → 警告＋非互動時唔自動前進（中止，RC=$RC）"
else
  bad "本機碟警告行為唔啱" "RC=$RC OUT=$(printf '%s' "$OUT" | grep -i '本機\|互動' | head -2)"
fi

# ── 測試 6：腳本內絕無 rsync 刪除旗標（無雙向同步）──────────
if grep -qF -- '--delete' "$SUT"; then
  bad "腳本內出現 rsync 刪除旗標（絕對唔准）" "$(grep -nF -- '--delete' "$SUT" | head -1)"
else
  ok "腳本內完全冇 rsync 刪除旗標（確認單向、唔會雙向同步）"
fi

echo "════════════════════════════════════════════════════"
echo "  結果：通過 ${PASS} ／ 失敗 ${FAIL}"
echo "════════════════════════════════════════════════════"
[ "$FAIL" -eq 0 ]
