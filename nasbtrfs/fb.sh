#!/bin/bash
# ============================================================================
#  Firebean — 喺 iMac 直接叫 NAS 做嘢（唔需要自己開 SSH 視窗）
#
#  ⚠️ 喺【iMac 嘅 Terminal】執行
#
#      bash ~/fb.sh preflight      ← 環境自檢
#      bash ~/fb.sh env            ← 讀取卷資料
#      bash ~/fb.sh gens           ← 數 extent 代數
#      bash ~/fb.sh doctor         ← 睇工具入咗未（第一句先跑呢個）
#
#  全程唯讀，唔會改你任何檔案。
# ============================================================================
set -u
# 靜默挑一個真存在嘅 UTF-8 locale（唔存在就唔設定，避免 setlocale warning）
for _L in en_US.UTF-8 en_US.utf8 C.UTF-8 zh_HK.UTF-8 UTF-8; do
  if locale -a 2>/dev/null | grep -qx "$_L"; then
    export LC_ALL="$_L" LANG="$_L"; break
  fi
done
unset _L
VERSION="fb10-20261030-2240"
BUILD=10

NAS_IP="${NAS_IP:-169.254.71.131}"
TARGET="${NAS_USER:-dickson}@${NAS_IP}"
REMOTE_DIR="/tmp/c3r"
TOOL="$REMOTE_DIR/c3r_btrfs.py"
SHARE="/volume3/FirebeanShare"
LOGDIR="$HOME/fb-nas-logs"

# 把路徑安全包成單引號（可處理檔名內嘅單引號）。
# ⚠️ 千萬唔可以用雙引號包路徑：REMOTE 本身已經喺 ssh 嘅 "…" 同 sh -c "…" 之中，
#    再套雙引號會令引號提早收口 → --g 參數會掉出 sh -c 外面（實測中過）。
sq() { printf '%s' "$1" | sed "s/'/'\\''/g"; }

# ══════════════════════════════════════════════════════════════
# 自我更新：用 GitHub API（零 CDN cache），確保永遠跑最新版。
# ⚠️ firebean.net 走 GitHub Pages，CDN cache 10 分鐘，連 ?v= 都攔唔住。
# ⚠️ 用獨立數字 BUILD 比較（唔可以用版本字串字典序：'fb09' < 'fb7'）。
# ══════════════════════════════════════════════════════════════
if [ "${FB_NO_UPDATE:-0}" != "1" ]; then
  _NEW=$(curl -fsSL --max-time 25 \
    "https://api.github.com/repos/cs627/Firebean-Website/contents/nasbtrfs/fb.sh?ref=main" 2>/dev/null \
    | perl -MMIME::Base64 -MJSON::PP -0777 -ne 'print decode_base64(decode_json($_)->{content})' 2>/dev/null)
  case "$_NEW" in
    \#!*) _NV=$(printf '%s' "$_NEW" | grep -m1 '^VERSION=' | cut -d'"' -f2)
          _NB=$(printf '%s' "$_NEW" | grep -m1 '^BUILD=' | cut -d= -f2 | tr -d '" ')
          [ -z "$_NB" ] && _NB=0
          if [ "$_NB" -gt "${BUILD:-0}" ] 2>/dev/null; then
            _SELF="$0"; case "$_SELF" in */*) ;; *) _SELF="./$_SELF" ;; esac
            if printf '%s' "$_NEW" > "$_SELF.new" 2>/dev/null; then
              mv "$_SELF.new" "$_SELF" && chmod +x "$_SELF" 2>/dev/null
              export FB_NO_UPDATE=1
              echo "  🔄 已自動更新：$VERSION → $_NV，重新執行…"
              echo
              exec bash "$_SELF" "$@"
            fi
          fi ;;
  esac
  unset _NEW _NV _NB _SELF
fi

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
    # ⚠️ 千萬唔可以用 $( )：喺 Mac 端會先展開（冇 root 權）→ 一定空。
    #    所有展開都要喺 NAS 端以 root 做。
    REMOTE="echo '=== 共享頂層 ==='; ls -la '$SHARE' | head -25; echo; echo '=== 最大 20 個受害檔 ==='; find '$SHARE' -name '*.L0CK3D' -exec ls -ld {} + 2>/dev/null | sort -k5 -rn | head -20; echo; echo '=== 受害檔總數 ==='; find '$SHARE' -name '*.L0CK3D' 2>/dev/null | wc -l; echo; echo '=== 勒索信 ==='; ls -l '$SHARE'/read-me* 2>/dev/null"
    SUDO="sudo"
    ;;
  plan1)
    FILE="${2:?用法: bash ~/fb.sh plan1 \"完整路徑.L0CK3D\" [G]}"
    FILE_Q=$(sq "$FILE")
    G="${3:-23082}"
    REMOTE="python3 $TOOL plan '$FILE_Q' --g $G 2>&1 | head -60"
    SUDO="sudo"
    ;;
  survey)
    G="${2:-23082}"
    SUBSET="${3:-$SHARE}"
    REMOTE="python3 $TOOL survey '$SUBSET' --g $G"
    SUDO="sudo"; STREAM="survey"
    ;;
  extract)
    G="${2:-23082}"
    SUBSET="${3:-$SHARE}"
    REMOTE="python3 $TOOL extract '$SUBSET' --g $G"
    SUDO="sudo"; STREAM="extract"
    ;;
  pick)
    REMOTE="echo '=== 50-600MB 圖／片／PDF（肉眼可驗證）==='; find '$SHARE' \\( -name '*.jpg.L0CK3D' -o -name '*.jpeg.L0CK3D' -o -name '*.png.L0CK3D' -o -name '*.pdf.L0CK3D' -o -name '*.mp4.L0CK3D' \\) -size +50M -size -600M -exec ls -ld {} + 2>/dev/null | sort -k5 -rn | head -20"
    SUDO="sudo"
    ;;
  prove)
    FILE="${2:?用法: bash ~/fb.sh prove \"完整路徑.L0CK3D\" [G]}"
    FILE_Q=$(sq "$FILE")
    G="${3:-23082}"
    REMOTE="python3 $TOOL plan '$FILE_Q' --g $G 1>&2; echo '=== PLAN 完，開始重組原檔 ===' 1>&2; python3 $TOOL extract '$FILE_Q' --g $G"
    SUDO="sudo"; STREAM="extract"
    ;;
  extract1)
    FILE="${2:?用法: bash ~/fb.sh extract1 \"完整路徑.L0CK3D\" [G]}"
    FILE_Q=$(sq "$FILE")
    G="${3:-23082}"
    REMOTE="python3 $TOOL extract '$FILE_Q' --g $G"
    SUDO="sudo"; STREAM="extract"
    ;;
  space)
    echo "=== Mac 家目錄 ==="; df -h "$HOME"
    echo; echo "=== 所有掛載卷 ==="; df -h | grep -vE "^devfs|^map " 
    exit 0
    ;;
  auto)
    DEST="${2:-$HOME/recovered}"
    REMOTE="auto"
    SUDO="sudo"; STREAM="auto"
    ;;
  pull)
    SUBSET="${2:?用法: bash ~/fb.sh pull \"NAS 路徑\" [G] [目的地]}"
    G="${3:-23082}"
    DEST="${4:-$HOME/recovered}"
    SUBSET_Q=$(sq "$SUBSET")
    REMOTE="python3 $TOOL extract '$SUBSET_Q' --g $G"
    SUDO="sudo"; STREAM="pull"
    ;;
  folders)
    REMOTE="echo '=== 各頂層資料夾：受害檔數（Top 30）==='; find '$SHARE' -name '*.L0CK3D' 2>/dev/null | cut -d/ -f4 | sort | uniq -c | sort -rn | head -30; echo; echo '=== 各頂層資料夾：大細（Top 30）==='; du -sh '$SHARE'/*/ 2>/dev/null | sort -rh | head -30"
    SUDO="sudo"
    ;;
  help)
    cat <<'EOF'
Firebean — 喺 iMac 直接叫 NAS 做嘢

用法（喺 iMac 嘅 Terminal 貼）：

  bash ~/fb.sh doctor      睇工具入咗 NAS 未（同 NAS 狀態）
  bash ~/fb.sh preflight   環境自檢（逐項 OK/WARN/FAIL）
  bash ~/fb.sh env         讀取卷／塊裝置／子卷資料
  bash ~/fb.sh gens        數 extent 代數 → 得出 G_ATTACK

之後（等上面結果）：
  survey [G]                   全卷分類（輸出存檔）
  extract [G]                  重組原檔（輸出 .tar）
  list                         列最大嘅受害檔
  pick                         列 50-600MB 圖／片／PDF（做證明測試最好）
  auto [目的地]                ★★ 無人值守：一次密碼→自動還原全部→逐批驗收
  pull "NAS 路徑" [G] [目的地]  直接串流還原 + 自動核 SHA-256（單一批次）
  folders                      各頂層資料夾嘅受害檔數＋大細（排批次次序）
  space                        睇 iMac／外接碟剩餘空間（完全本機，唔連 NAS）
  prove "路徑" [G]             ★ 一次過：分析 + 還原單一檔（證明測試）
  extract1 "路徑" [G]          還原單一檔 → .tar
  plan1 "路徑.L0CK3D" [G]      單一檔重組計劃（證明測試）

⚠️ 會問 NAS 密碼（可能問兩次：SSH 一次、sudo 一次）。
   打字時畫面唔會顯示任何字，係正常。
EOF
    exit 0
    ;;
  *)
    echo "  ❌ 冇呢個任務：「${TASK}」"
    echo
    echo "  可用任務：doctor / preflight / env / gens / list / pick /"
    echo "            prove <路徑> / plan1 <路徑> / extract1 <路徑> / survey / extract"
    echo "            auto / pull <路徑> / folders / space"
    echo
    echo "  打「bash ~/fb.sh help」睇詳細用法。"
    exit 2
    ;;
esac

echo "════════════════════════════════════════════════════"
echo "  Firebean — NAS 任務：${TASK}"
echo "════════════════════════════════════════════════════"
echo "  目標      : $TARGET"
echo "  動作      : $REMOTE"
echo "  唯讀保證  : ❌ 唔會改你任何檔案"
echo "  版本      : $VERSION"
echo "════════════════════════════════════════════════════"
echo
echo "  ⚠️ 會問 NAS 密碼。打字時畫面【唔會顯示任何字】（冇 ••、冇星號）。"
echo "      呢個係正常，打完直接按 Enter。"
echo

mkdir -p "$LOGDIR"
STAMP=$(date '+%Y%m%d-%H%M%S')
LOG="$LOGDIR/${TASK}-${STAMP}.txt"

if [ "$STREAM" = "auto" ]; then
  # ═══ 無人值守：一次密碼 → 自動順序還原所有資料夾 → 逐批驗收 ═══
  mkdir -p "$DEST" "$LOGDIR"
  A_STAMP=$(date '+%Y%m%d-%H%M%S')
  REP="$LOGDIR/auto-${A_STAMP}.report.txt"
  ERRF="$LOGDIR/auto-${A_STAMP}.err"
  : > "$REP"; : > "$ERRF"
  echo "  ══════════════ Firebean 自動還原（無人值守）══════════════"
  echo "  目的地     : $DEST"
  df -h "$DEST" | tail -1
  echo "  報告檔     : $REP"
  echo "  ══════════════════════════════════════════════════════════"
  echo
  printf "  🔑 NAS sudo 密碼（唔會顯示、唔會寫入磁碟）："
  read -r -s A_PW
  echo; echo
  if ! printf '%s\n' "$A_PW" | ssh -T -o ConnectTimeout=15 "$TARGET" "sudo -S -p '' true" 2>/dev/null; then
    echo "  ❌ 密碼唔啱或連唔上 NAS —— 中止，冇改動過任何嘢。"
    unset A_PW; exit 1
  fi
  echo "  ✅ 密碼正確"
  echo
  echo "  ⚠️  之後請【唔好關呢個 Terminal 視窗、唔好熄機、唔好拔線】"
  echo "  ⚠️  想安全中斷：按 Control-C（已還原嘅檔唔會消失，可續跑）"
  echo
  # 防止 Mac 休眠
  caffeinate -i -w $$ 2>/dev/null &
  # 取批次清單：由細至大，排除 #recycle / sparsebundle / @eaDir
  A_LIST=$(ssh -T -o ConnectTimeout=20 "$TARGET" "sudo sh -c \"cd '$SHARE' && du -sk */ 2>/dev/null\"" 2>/dev/null \
           | grep -vE '#recycle|sparsebundle|@eaDir' | sort -n)
  if [ -z "$A_LIST" ]; then echo "  ❌ 攞唔到資料夾清單"; unset A_PW; exit 1; fi
  A_TOTAL=$(printf '%s\n' "$A_LIST" | grep -c .)
  echo "  📋 共 $A_TOTAL 個資料夾（由細至大處理）"
  echo

  A_N=0; A_OK=0; A_BAD=0; A_MISS=0; A_BYTES=0; A_SKIP=0
  while IFS=$'\t' read -r A_KB A_DIR; do
    [ -z "$A_DIR" ] && continue
    A_N=$((A_N+1))
    # ⚠️ 單位鐵律：du -sk 同 df -k 都係 KB。A_NEED 必須係 KB（×1.1 安全邊際）。
    A_NEED=$(( A_KB * 11 / 10 + 1024 ))
    A_FREE=$(df -k "$DEST" 2>/dev/null | tail -1 | awk '{print $4}')
    [ -z "$A_FREE" ] && A_FREE=0
    echo "  ────────────────────────────────────────────────────────"
    echo "  [$A_N/$A_TOTAL] $A_DIR"
    echo "     需要約 $((A_KB/1024)) MB   ／   剩餘 $((A_FREE/1048576)) GB"
    if [ "$A_FREE" -lt "$A_NEED" ]; then
      echo "     ⏭️  空間不足 → 跳過（留待插第二隻碟再跑）"
      A_SKIP=$((A_SKIP+1))
      printf '跳過(空間不足)\t%s\n' "$A_DIR" >> "$REP"
      continue
    fi
    A_DQ=$(sq "$SHARE/$A_DIR")
    A_R="python3 $TOOL extract '$A_DQ' --g 23082"
    printf '%s\n' "$A_PW" | ssh -T -o ConnectTimeout=20 "$TARGET" "sudo -S -p '' sh -c \"$A_R\"" 2>>"$ERRF" \
      | tar -xf - -C "$DEST" 2>>"$ERRF"
    A_MAN="$DEST/_c3r_manifest.jsonl"
    if [ -f "$A_MAN" ]; then
      B_OK=0; B_BAD=0; B_MISS=0; B_BYTES=0
      while IFS= read -r A_LINE; do
        A_M=$(printf '%s' "$A_LINE" | sed -n 's/.*"member":[[:space:]]*"\([^"]*\)".*/\1/p')
        A_H=$(printf '%s' "$A_LINE" | sed -n 's/.*"sha256":[[:space:]]*"\([^"]*\)".*/\1/p')
        A_SZ=$(printf '%s' "$A_LINE" | sed -n 's/.*"orig":[[:space:]]*\([0-9]*\).*/\1/p')
        if [ -z "$A_M" ] || [ -z "$A_H" ]; then continue; fi
        A_F="$DEST/$A_M"
        if [ ! -f "$A_F" ]; then B_MISS=$((B_MISS+1)); continue; fi
        A_CK=$(shasum -a 256 "$A_F" 2>/dev/null | cut -d' ' -f1)
        if [ "$A_CK" = "$A_H" ]; then
          B_OK=$((B_OK+1)); B_BYTES=$((B_BYTES + ${A_SZ:-0}))
        else
          echo "     ❌ SHA 唔對：$A_M"; B_BAD=$((B_BAD+1))
        fi
      done < "$A_MAN"
      A_OK=$((A_OK+B_OK)); A_BAD=$((A_BAD+B_BAD)); A_MISS=$((A_MISS+B_MISS)); A_BYTES=$((A_BYTES+B_BYTES))
      echo "     ✅ $B_OK 通過 ／ ❌ $B_BAD 唔對 ／ ❌ $B_MISS 唔見 ／ 📦 $((B_BYTES/1048576)) MB"
      printf '✅ %s\t通過 %s\t唔對 %s\t唔見 %s\tbytes %s\n' "$A_DIR" "$B_OK" "$B_BAD" "$B_MISS" "$B_BYTES" >> "$REP"
      rm -f "$A_MAN"
    else
      echo "     ⚠️ 冇 manifest，跳過核對"
      printf '⚠️ 冇manifest\t%s\n' "$A_DIR" >> "$REP"
    fi
  done < <(printf '%s\n' "$A_LIST")

  unset A_PW
  echo
  echo "  ══════════════════ 最終驗收報告 ══════════════════"
  echo "  📁 處理資料夾    ：$A_N / $A_TOTAL（跳過 $A_SKIP）"
  echo "  ✅ SHA-256 通過  ：$A_OK 個檔案"
  echo "  ❌ SHA-256 唔對  ：$A_BAD 個"
  echo "  ❌ 檔案唔見      ：$A_MISS 個"
  echo "  📦 已還原總量    ：$A_BYTES bytes"
  echo "  📄 詳情報告      ：$REP"
  echo "  ══════════════════════════════════════════════════"
  df -h "$DEST" | tail -1
  echo
  echo "  ✅ 全部完成。你可以放心離開 —— 唔會再動 NAS 上任何嘢。"
  exit 0
elif [ "$STREAM" = "pull" ]; then
  # ★ 直接串流：NAS 的 tar → 本機 tar -xf（唔會留中間 .tar，省一半空間）
  mkdir -p "$DEST"
  echo "  📂 目的地：$DEST"
  printf "  🔑 NAS sudo 密碼（唔會顯示、唔會記錄）："
  read -r -s SUDOPW
  echo
  echo "  ⬇️  串流還原中…（大檔可能要幾分鐘）"
  echo
  printf '%s\n' "$SUDOPW" | ssh -T -o ConnectTimeout=15 "$TARGET" "${SUDO} -S -p '' sh -c \"$REMOTE\"" 2>"$LOGDIR/${TASK}-${STAMP}.err" | tar -xf - -C "$DEST" 2>>"$LOGDIR/${TASK}-${STAMP}.err"
  RC=${PIPESTATUS[1]}
  unset SUDOPW
  echo "  ✅ 解壓完成"
  echo
  MAN="$DEST/_c3r_manifest.jsonl"
  if [ -f "$MAN" ]; then
    echo "  ── 自動核對 SHA-256（工具自己算出嚟嘅值）──"
    OK=0; BAD=0; MISS=0; BYTES=0
    while IFS= read -r LINE; do
      M=$(printf '%s' "$LINE" | sed -n 's/.*"member":[[:space:]]*"\([^"]*\)".*/\1/p')
      H=$(printf '%s' "$LINE" | sed -n 's/.*"sha256":[[:space:]]*"\([^"]*\)".*/\1/p')
      SZ=$(printf '%s' "$LINE" | sed -n 's/.*"orig":[[:space:]]*\([0-9]*\).*/\1/p')
      if [ -z "$M" ] || [ -z "$H" ]; then continue; fi
      F="$DEST/$M"
      if [ ! -f "$F" ]; then echo "  ❌ 唔見檔：$M"; MISS=$((MISS+1)); continue; fi
      A=$(shasum -a 256 "$F" 2>/dev/null | cut -d' ' -f1)
      if [ "$A" = "$H" ]; then
        OK=$((OK+1)); BYTES=$((BYTES + ${SZ:-0}))
      else
        echo "  ❌ SHA 唔對：$M"; BAD=$((BAD+1))
      fi
    done < "$MAN"
    echo
    echo "  ══════════ 驗收報告 ══════════"
    echo "  ✅ SHA-256 通過    ：$OK 個"
    echo "  ❌ SHA-256 唔對    ：$BAD 個"
    echo "  ❌ 檔案唔見        ：$MISS 個"
    echo "  📦 已還原總量      ：$BYTES bytes"
    echo "  ════════════════════════════"
  else
    echo "  ⚠️ 冇搵到 manifest（_c3r_manifest.jsonl），跳過自動核對"
  fi
  echo
  echo "  ── stderr（如有）──"
  tail -8 "$LOGDIR/${TASK}-${STAMP}.err" 2>/dev/null
elif [ -n "$STREAM" ]; then
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
