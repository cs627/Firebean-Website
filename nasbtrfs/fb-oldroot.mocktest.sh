#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  fb-oldroot.sh 離線 mock 測試（唔會連 NAS、唔會真跑 btrfs）
#
#  • 用一個假 ssh（記錄指令、按關鍵字回假輸出）＋ 假 btrfs-find-root 輸出
#  • 驗證四點：
#      1. 未知子命令 → 印「冇呢個任務」＋清單＋exit 2
#      2. 跑錯機自我識別 → 喺「NAS」上跑會停＋印「呢句要喺 Mac 跑」＋exit 3
#      3. 受害卷寫入拒絕 → 輸出目錄含 /volume3 → 拒絕＋exit 2＋冇叫過 ssh
#      4. dry-run 預設 → 未確認前只跑 -D（dry-run），冇真正 restore
#
#  用法：bash fb-oldroot.mocktest.sh [被測腳本路徑]
# ═══════════════════════════════════════════════════════════════
set -u

SUT="${1:-$(dirname "$0")/fb-oldroot.sh}"
SUT="$(cd "$(dirname "$SUT")" && pwd)/$(basename "$SUT")"
if [ ! -f "$SUT" ]; then
  echo "搵唔到被測腳本：$SUT"
  exit 1
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
BIN="$TMP/bin"; mkdir -p "$BIN"
export SSH_LOG="$TMP/ssh-calls.log"

# ── 假 ssh：記錄每個指令，按關鍵字回假輸出 ──────────────────
cat > "$BIN/ssh" <<'FAKESSH'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$SSH_LOG"
CMD="$*"
case "$CMD" in
  *"sudo -S -p '' true"*) exit 0 ;;                       # 密碼驗證成功
esac
case "$CMD" in
  *"command -v btrfs-find-root"*) echo "/usr/bin/btrfs-find-root"; exit 0 ;;
  *"command -v btrfs"*)           echo "/usr/bin/btrfs"; exit 0 ;;
  *"subvolume show"*)             echo "Subvolume ID:   256"; exit 0 ;;
esac
case "$CMD" in
  *"btrfs-find-root -a"*)
    cat <<'FR'
Superblock thinks the generation is 18141107
Superblock thinks the level is 1
Well block 29360128(gen: 18141060 level: 1) seems good
Well block 29376512(gen: 18141107 level: 0) seems good
Well block 29380608(gen: 18141129 level: 0) seems good
Well block 29384704(gen: 18141132 level: 0) seems good
FR
    exit 0 ;;
esac
case "$CMD" in
  *"btrfs restore -D"*)
    echo "Restoring /FirebeanShare/[56] O'South/a.jpg"
    echo "Restoring /FirebeanShare/[56] O'South/b.mp4"
    echo "Restoring /FirebeanShare/[91] ACAN 60A/c.pdf"
    exit 0 ;;
esac
case "$CMD" in
  *"lvs"*|*"/dev/mapper"*) echo "/dev/mapper/vg1-volume_1"; exit 0 ;;
esac
exit 0
FAKESSH
chmod +x "$BIN/ssh"
export PATH="$BIN:$PATH"

PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); printf '  ✅ %s\n' "$1"; }
bad()  { FAIL=$((FAIL+1)); printf '  ❌ %s\n      %s\n' "$1" "${2:-}"; }

# 每個測試用獨立 HOME（隔離記錄檔）
run_case() {  # run_case <home> <stdin> -- <args...>
  local home="$1"; shift
  mkdir -p "$home"
  HOME="$home" bash "$SUT" "$@"
}

echo "════════════════════════════════════════════════════"
echo "  fb-oldroot.sh mock 測試"
echo "  被測：$SUT"
echo "════════════════════════════════════════════════════"

# ── 測試 1：未知子命令 ──────────────────────────────────────
: > "$SSH_LOG"
H1="$TMP/h1"
OUT=$(HOME="$H1" bash "$SUT" frobnicate 2>&1); RC=$?
if [ "$RC" = "2" ] && printf '%s' "$OUT" | grep -q '冇呢個任務' && printf '%s' "$OUT" | grep -q 'doctor / findroot / restore / scan'; then
  ok "未知子命令 → 印「冇呢個任務」＋可用清單＋exit 2"
else
  bad "未知子命令行為唔啱" "RC=$RC OUT=$(printf '%s' "$OUT" | head -3)"
fi

# ── 測試 2：跑錯機（自稱喺 NAS 上）─────────────────────────
touch "$TMP/nasmarker"
OUT=$(FB_SYNOINFO="$TMP/nasmarker" HOME="$TMP/h2" bash "$SUT" doctor 2>&1); RC=$?
if [ "$RC" = "3" ] && printf '%s' "$OUT" | grep -q '呢句要喺 Mac 跑'; then
  ok "自我識別（FB_SYNOINFO 存在）→ 停＋印「呢句要喺 Mac 跑」＋exit 3"
else
  bad "自我識別（synoinfo）唔啱" "RC=$RC OUT=$(printf '%s' "$OUT" | head -2)"
fi
mkdir -p "$TMP/nasdir"
OUT=$(FB_NAS_MARKERS="$TMP/nasdir" HOME="$TMP/h2b" bash "$SUT" doctor 2>&1); RC=$?
if [ "$RC" = "3" ] && printf '%s' "$OUT" | grep -q '呢句要喺 Mac 跑'; then
  ok "自我識別（NAS 標記目錄存在）→ 停＋exit 3"
else
  bad "自我識別（標記目錄）唔啱" "RC=$RC"
fi

# ── 測試 3：受害卷寫入拒絕（而且唔應該叫過 ssh）────────────
: > "$SSH_LOG"
OUT=$(HOME="$TMP/h3" bash "$SUT" restore 12345 /volume3/recovered 2>&1); RC=$?
if [ "$RC" = "2" ] && printf '%s' "$OUT" | grep -q '拒絕' && printf '%s' "$OUT" | grep -q '/volume3'; then
  ok "受害者卷輸出 → 拒絕＋exit 2"
else
  bad "受害卷拒絕唔啱" "RC=$RC OUT=$(printf '%s' "$OUT" | grep -i 拒絕 | head -1)"
fi
if [ ! -s "$SSH_LOG" ]; then
  ok "受害卷拒絕發生喺問密碼／連線之前（SSH 一次都冇叫）"
else
  bad "受害卷拒絕時竟然叫過 ssh" "$(head -1 "$SSH_LOG")"
fi

# ── 測試 4：dry-run 預設（未確認前唔會真正 restore）────────
: > "$SSH_LOG"
OUT=$(printf 'dummypw\n\n' | FB_BLOCKDEV=/dev/mapper/vg1-volume_1 HOME="$TMP/h4" bash "$SUT" restore 12345 /volume2/unused-recovered 2>&1); RC=$?
if [ "$RC" = "0" ] && printf '%s' "$OUT" | grep -q 'DRY-RUN' && printf '%s' "$OUT" | grep -q '已取消'; then
  ok "預設 dry-run：跑咗 -D 之後，冇打 yes 就取消＋exit 0"
else
  bad "dry-run 預設行為唔啱" "RC=$RC"
fi
if grep -q 'btrfs restore -D' "$SSH_LOG"; then
  ok "有發射 dry-run 指令（btrfs restore -D）"
else
  bad "冇見到 dry-run 指令" "$(cat "$SSH_LOG")"
fi
# 確認：所有 btrfs restore 指令都帶 -D（即冇任何「真正還原」）
if grep 'btrfs restore' "$SSH_LOG" | grep -v -- '-D' | grep -q .; then
  bad "出現咗唔帶 -D 嘅真正 restore 指令（唔應該）" "$(grep 'btrfs restore' "$SSH_LOG" | grep -v -- '-D')"
else
  ok "所有 restore 指令都係 dry-run（-D）：冇真正寫入"
fi

echo "════════════════════════════════════════════════════"
echo "  結果：通過 ${PASS} ／ 失敗 ${FAIL}"
echo "════════════════════════════════════════════════════"
[ "$FAIL" -eq 0 ]
