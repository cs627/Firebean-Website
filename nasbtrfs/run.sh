#!/bin/bash
# ============================================================================
#  Firebean — 喺 iMac 直接叫 NAS 做嘢（唔需要自己開 SSH 視窗）
#
#  ⚠️ 喺【iMac 嘅 Terminal】執行
#
#      bash ~/fb-run.sh preflight      ← 環境自檢
#      bash ~/fb-run.sh env            ← 讀取卷資料
#      bash ~/fb-run.sh gens           ← 數 extent 代數
#      bash ~/fb-run.sh doctor         ← 睇工具入咗未（第一句先跑呢個）
#
#  全程唯讀，唔會改你任何檔案。
# ============================================================================
set -u

NAS_IP="${NAS_IP:-169.254.71.131}"
TARGET="${NAS_USER:-dickson}@${NAS_IP}"
REMOTE_DIR="/tmp/c3r"
TOOL="$REMOTE_DIR/c3r_btrfs.py"
SHARE="/volume3/FirebeanShare"
LOGDIR="$HOME/fb-nas-logs"

TASK="${1:-help}"
STREAM=""

case "$TASK" in
  doctor)
    REMOTE="echo '=== 工具 ==='; ls -l $REMOTE_DIR/ 2>&1; echo; echo '=== Python ==='; python3 -V 2>&1; echo; echo '=== 卷 ==='; df -h /volume3 2>&1 | tail -2; echo; echo '=== 病毒殘留 ==='; ps w 2>/dev/null | grep -c '[l]ibgld' ; ls -l /bin/libgld 2>/dev/null || echo '/bin/libgld 已不存在（重裝 DSM 清走）'"
    SUDO=""
    ;;
  preflight)
    REMOTE="python3 $TOOL preflight $SHARE 2>&1 | head -80"
    SUDO="sudo"
    ;;
  env)
    REMOTE="python3 $TOOL env $SHARE 2>&1 | head -100"
    SUDO="sudo"
    ;;
  gens)
    REMOTE="python3 $TOOL gens $SHARE --sample 120 2>&1 | tail -40"
    SUDO="sudo"
    ;;
  list)
    REMOTE="ls -lS \$(find $SHARE -maxdepth 2 -name '*.L0CK3D' 2>/dev/null | head -400) 2>/dev/null | head -16"
    SUDO="sudo"
    ;;
  plan1)
    FILE="${2:?用法: bash ~/fb-run.sh plan1 \"完整路徑.L0CK3D\" [G]}"
    G="${3:-1}"
    REMOTE="python3 $TOOL plan \"$FILE\" --g $G 2>&1 | head -60"
    SUDO="sudo"
    ;;
  survey)
    G="${2:-1}"
    REMOTE="python3 $TOOL survey $SHARE --g $G"
    SUDO="sudo"; STREAM="survey"
    ;;
  extract)
    G="${2:-1}"
    REMOTE="python3 $TOOL extract $SHARE --g $G"
    SUDO="sudo"; STREAM="extract"
    ;;
  help|*)
    cat <<'EOF'
Firebean — 喺 iMac 直接叫 NAS 做嘢

用法（喺 iMac 嘅 Terminal 貼）：

  bash ~/fb-run.sh doctor      睇工具入咗 NAS 未（同 NAS 狀態）
  bash ~/fb-run.sh preflight   環境自檢（逐項 OK/WARN/FAIL）
  bash ~/fb-run.sh env         讀取卷／塊裝置／子卷資料
  bash ~/fb-run.sh gens        數 extent 代數 → 得出 G_ATTACK

之後（等上面結果）：
  survey [G]                   全卷分類（輸出存檔）
  extract [G]                  重組原檔（輸出 .tar）
  list                         列最大嘅受害檔（做證明測試用）
  plan1 "路徑.L0CK3D" [G]      單一檔重組計劃（證明測試）

⚠️ 會問 NAS 密碼（可能問兩次：SSH 一次、sudo 一次）。
   打字時畫面唔會顯示任何字，係正常。
EOF
    exit 0
    ;;
esac

echo "════════════════════════════════════════════════════"
echo "  Firebean — NAS 任務：$TASK"
echo "════════════════════════════════════════════════════"
echo "  目標      : $TARGET"
echo "  動作      : $REMOTE"
echo "  唯讀保證  : ❌ 唔會改你任何檔案"
echo "════════════════════════════════════════════════════"
echo
echo "  ⚠️ 會問 NAS 密碼。打字時畫面【唔會顯示任何字】（冇 ••、冇星號）。"
echo "      呢個係正常，打完直接按 Enter。"
echo

mkdir -p "$LOGDIR"
STAMP=$(date '+%Y%m%d-%H%M%S')
LOG="$LOGDIR/${TASK}-${STAMP}.txt"

if [ -n "$STREAM" ]; then
  # 大流量／二進位輸出：唔可以用 ssh -t（tty 會做 CR/LF 轉換，會搞爛 tar / gz）
  # 用 sudo -S 由本機讀密碼，保持 stdout 純淨
  if [ "$STREAM" = "extract" ]; then OUTF="$LOGDIR/extract-${STAMP}.tar"; else OUTF="$LOG"; fi
  printf "  🔑 NAS sudo 密碼（唔會顯示、唔會記錄）："
  read -r -s SUDOPW
  echo
  printf '%s\n' "$SUDOPW" | ssh -T -o ConnectTimeout=15 "$TARGET" "${SUDO} -S -p '' sh -c \"$REMOTE\"" > "$OUTF" 2>"$LOGDIR/${TASK}-${STAMP}.err"
  RC=$?
  unset SUDOPW
  echo
  echo "  ✅ 輸出檔：$OUTF"
  echo "     大小：$(ls -lh "$OUTF" 2>/dev/null | awk '{print $5}')"
  echo
  echo "  ── 最後 15 行 ──"
  tail -15 "$OUTF" 2>/dev/null
  if [ -s "$LOGDIR/${TASK}-${STAMP}.err" ]; then
    echo
    echo "  ── stderr ──"
    tail -15 "$LOGDIR/${TASK}-${STAMP}.err"
  fi
elif [ -n "$SUDO" ]; then
  ssh -t -o ConnectTimeout=15 "$TARGET" "${SUDO} sh -c \"$REMOTE\"" 2>&1 | tee "$LOG"
  RC=${PIPESTATUS[0]}
else
  ssh -t -o ConnectTimeout=15 "$TARGET" "sh -c \"$REMOTE\"" 2>&1 | tee "$LOG"
  RC=${PIPESTATUS[0]}
fi

echo
echo "════════════════════════════════════════════════════"
if [ "$RC" = "0" ]; then
  echo "  ✅ 完成"
else
  echo "  ⚠️ 完成但有非零結束碼：$RC"
fi
echo "  輸出已存檔：$LOG"
echo "════════════════════════════════════════════════════"
echo
echo "  ➜ 請將上面全部輸出掟返俾 Hermes，或者喺 Discord 上傳："
echo "     $LOG"
echo
