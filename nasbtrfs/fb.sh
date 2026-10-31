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
VERSION="fb21-20261031-1130"
BUILD=21

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
              echo "  🔄 已自動更新：$VERSION → ${_NV}，重新執行…"
              echo
              exec bash "$_SELF" "$@"
            fi
          fi ;;
  esac
  unset _NEW _NV _NB _SELF
fi

# ── 持久 SSH 連線（ControlMaster）：只需打一次【SSH 登入密碼】──────────
# 冇呢個，auto 會逐個資料夾問一次登入密碼（200 次）→ 冇人值守就一定死。
# ⚠️ ControlMaster 只喺本機開 socket，【唔會寫入 NAS】任何嘢。
FB_SSH_SOCK=""
cm_setup() {
  [ -n "$FB_SSH_SOCK" ] && return 0
  mkdir -p "$HOME/.ssh" 2>/dev/null; chmod 700 "$HOME/.ssh" 2>/dev/null
  FB_SSH_SOCK="$HOME/.ssh/fb-cm-$$"
  echo "  🔌 建立持久連線…（會問一次 NAS 登入密碼，之後唔會再問）"
  if ssh -M -S "$FB_SSH_SOCK" -o ControlPersist=12h -o ConnectTimeout=20 -o NumberOfPasswordPrompts=3 -fN "$TARGET" 2>/dev/null; then
    echo "  ✅ 持久連線已建立（全程唔會再問登入密碼）"
    return 0
  fi
  echo "  ⚠️ 持久連線失敗 → 每個資料夾都會再問登入密碼（仍然可行，但要你坐喺度）"
  FB_SSH_SOCK=""
  return 1
}
cm_close() { [ -n "$FB_SSH_SOCK" ] && ssh -S "$FB_SSH_SOCK" -O exit "$TARGET" 2>/dev/null; FB_SSH_SOCK=""; }
rssh() {  # rssh "<remote cmd>"   —— stdin 由呼叫者提供
  if [ -n "$FB_SSH_SOCK" ]; then
    ssh -S "$FB_SSH_SOCK" -T -o ConnectTimeout=20 "$TARGET" "$1"
  else
    ssh -T -o ConnectTimeout=20 "$TARGET" "$1"
  fi
}

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
  cloud)
    # ⭐ 純雲救援：NAS → 本地暫存 .tar → 逐檔核 SHA-256 → 上傳 Google Drive → 刪本地
    CLOUD_TMP=${2:-$HOME/fb-cloud-tmp}
    CLOUD_REM=${3:-gdrive:FirebeanRescue}
    echo "  ═══════ Firebean 雲端救援（NAS → Google Drive）═══════"
    echo "  暫存目錄   : ${CLOUD_TMP}（放大 tar，用完即刪）"
    echo "  雲端目的地 : $CLOUD_REM"
    echo "  ══════════════════════════════════════════════════════"
    echo
    if ! command -v rclone >/dev/null 2>&1; then
      echo "  ❌ 未安裝 rclone。請先執行：  brew install rclone"
      echo "     然後：  rclone config    （設定一個叫 gdrive 嘅遙端，類型揀 drive）"
      exit 1
    fi
    echo "  🔎 檢查雲端連線…"
    if ! rclone mkdir "$CLOUD_REM" 2>/dev/null; then
      echo "  ❌ 連唔上 $CLOUD_REM"
      echo "     請先跑：rclone config  → 新增遙端，名 gdrive，類型 drive"
      exit 1
    fi
    echo "  ✅ 雲端就緒"
    mkdir -p "$CLOUD_TMP/_done" || exit 1
    cat > "$CLOUD_TMP/fb_verify_tar.py" <<'PYV'
#!/usr/bin/env python3
# fb_verify_tar.py —— 單次讀取核對 tar 內每個檔嘅 SHA-256（完全唔解壓、唔佔額外空間）
import sys, tarfile, hashlib, json, os
MAN = '_c3r_manifest.jsonl'
def main(path):
    ok = bad = miss = 0
    nbytes = 0
    hashes = {}
    sizes = {}
    manlines = []
    with tarfile.open(path, 'r|*') as tf:
        for m in tf:
            if not m.isfile():
                continue
            f = tf.extractfile(m)
            if f is None:
                continue
            if os.path.basename(m.name) == MAN:
                manlines = f.read().decode('utf-8', 'replace').splitlines()
                continue
            h = hashlib.sha256(); n = 0
            while True:
                b = f.read(4 * 1024 * 1024)
                if not b:
                    break
                h.update(b); n += len(b)
            hashes[m.name] = h.hexdigest(); sizes[m.name] = n
    if not manlines:
        print(json.dumps({'ok': 0, 'bad': 0, 'miss': 0, 'bytes': 0, 'err': 'no-manifest'}))
        return
    for line in manlines:
        line = line.strip()
        if not line:
            continue
        try:
            e = json.loads(line)
        except Exception:
            continue
        mem = (e.get('member') or '').lstrip('./')
        exp = (e.get('sha256') or '').lower()
        got = hashes.get(mem)
        if got is None:
            base = os.path.basename(mem)
            cand = [v for k, v in hashes.items() if os.path.basename(k) == base]
            got = cand[0] if len(cand) == 1 else None
        if got is None:
            miss += 1
        elif got == exp:
            ok += 1; nbytes += sizes.get(mem, 0)
        else:
            bad += 1
    print(json.dumps({'ok': ok, 'bad': bad, 'miss': miss, 'bytes': nbytes}))
if __name__ == '__main__':
    import traceback
    try:
        main(sys.argv[1])
    except Exception as e:
        print(json.dumps({'ok': 0, 'bad': 0, 'miss': 0, 'bytes': 0,
                          'err': type(e).__name__ + ': ' + str(e)[:120]}))


PYV
    echo
    cm_setup
    echo
    printf "  🔑 NAS sudo 密碼（唔會顯示、唔會寫入磁碟）："
    read -r -s C_PW
    echo; echo
    if ! printf '%s\n' "$C_PW" | rssh "sudo -S -p '' true" 2>/dev/null; then
      echo "  ❌ 密碼唔正確"; unset C_PW; cm_close; exit 1
    fi
    echo "  ✅ 密碼正確"
    A_EXCL='#recycle|sparsebundle|MobileSync|Time Machine|TimeMachine|iPhone|iPad|iTunes|iDevice|/Backup/$'
    C_ALL=$(printf '%s\n' "$C_PW" | rssh "sudo -S -p '' sh -c \"cd '$SHARE' && du -sk */ 2>/dev/null\"" 2>/dev/null | grep -vE '@eaDir')
    C_LIST=$(printf '%s\n' "$C_ALL" | grep -Eiv "$A_EXCL" | sort -n)
    if [ -z "$C_LIST" ]; then
      echo "  ❌ 攞唔到資料夾清單 —— 掟返俾 Hermes"; unset C_PW; cm_close; exit 1
    fi
    C_TOTAL=$(printf '%s\n' "$C_LIST" | grep -c .)
    C_OK=0; C_BAD=0; C_DONE=0; C_N=0; C_BYTES=0
    C_REP="$LOGDIR/cloud-$STAMP.report.txt"
    : > "$C_REP"
    echo
    echo "  📋 共 $C_TOTAL 個資料夾（由細至大）"
    printf '%s\n' "$C_LIST" | while IFS=$'\t' read -r C_K C_D; do
      [ -n "$C_D" ] || continue
      C_N=$((C_N+1))
      C_TAG=$(printf '%s' "$C_D" | tr -d '/' | tr ' ' '_')
      if [ -f "$CLOUD_TMP/_done/$C_TAG" ]; then
        echo "  [已上雲，跳過] $C_D"
        continue
      fi
      echo "  ────────────────────────────────────────────────"
      echo "  [$C_N/$C_TOTAL] $C_D"
      C_TAR="$CLOUD_TMP/$C_TAG.tar"
      echo "     ⬇️  串流抽出（NAS → 本地暫存 tar）…"
      C_R="cd '$SHARE' && python3 /tmp/c3r/c3r_btrfs.py extract --root '$SHARE/$C_D' --out - 2>/dev/null && echo -n ''"
      printf '%s\n' "$C_PW" | rssh "sudo -S -p '' sh -c \"$C_R\"" 2>"$LOGDIR/cloud-$STAMP.err" > "$C_TAR"
      if [ ! -s "$C_TAR" ]; then
        echo "     ⚠️ 收唔到資料 → 重試一次…"
        printf '%s\n' "$C_PW" | rssh "sudo -S -p '' sh -c \"$C_R\"" 2>>"$LOGDIR/cloud-$STAMP.err" > "$C_TAR"
      fi
      if [ ! -s "$C_TAR" ]; then
        echo "     ❌ 仍然收唔到 → 跳過（報告已記錄）"
        printf '⚠️ 冇資料\t%s\n' "$C_D" >> "$C_REP"
        rm -f "$C_TAR"
        continue
      fi
      C_SZ=$(wc -c < "$C_TAR" | tr -d ' ')
      echo "     🔍 逐檔核 SHA-256（單次讀取，唔解壓）… tar 大細 $((C_SZ/1048576)) MB"
      C_OUT=$(python3 "$CLOUD_TMP/fb_verify_tar.py" "$C_TAR" 2>/dev/null)
      # ⚠️ 鐵律：空輸出或任何 err ＝ 失敗（唔可以當通過，否则壞檔照上雲）
      C_ERR=""
      case "$C_OUT" in
        '')       C_ERR="核對器冇輸出（tar 可能損壞或截斷）" ;;
        *'"err"'*) C_ERR="核對器報錯 $(printf '%s' "$C_OUT" | sed -n 's/.*"err": *"\([^"]*\)".*/\1/p')" ;;
      esac
      if [ -n "$C_ERR" ]; then
        echo "     ❌ $C_ERR → 唔會上傳（下次自動重做）"
        printf '❗ %s\t%s\n' "$C_D" "$C_ERR" >> "$C_REP"
        C_BAD=$((C_BAD+1))
        rm -f "$C_TAR"
        continue
      fi
      C_B=$(printf '%s' "$C_OUT" | sed -n 's/.*"bad": *\([0-9]*\).*/\1/p')
      C_M=$(printf '%s' "$C_OUT" | sed -n 's/.*"miss": *\([0-9]*\).*/\1/p')
      C_O=$(printf '%s' "$C_OUT" | sed -n 's/.*"ok": *\([0-9]*\).*/\1/p')
      C_BY=$(printf '%s' "$C_OUT" | sed -n 's/.*"bytes": *\([0-9]*\).*/\1/p')
      C_B=${C_B:-0}; C_M=${C_M:-0}; C_O=${C_O:-0}; C_BY=${C_BY:-0}
      printf '     ✅ 通過 %s ／ ❌ 唔對 %s ／ ❌ 唔見 %s ／ 📦 %s MB\n' "$C_O" "$C_B" "$C_M" "$((C_BY/1048576))"
      if [ "$C_B" -ne 0 ] || [ "$C_M" -ne 0 ]; then
        echo "     ❌ 核對唔過 → 唔會上傳（下次自動重做）"
        printf '❗ %s\t通過 %s\t唔對 %s\t唔見 %s\n' "$C_D" "$C_O" "$C_B" "$C_M" >> "$C_REP"
        C_BAD=$((C_BAD+1))
        rm -f "$C_TAR"
        continue
      fi
      echo "     ☁️  上傳去 Drive…"
      if rclone copyto "$C_TAR" "$CLOUD_REM/$C_TAG.tar" --drive-chunk-size 64M --stats-one-line --log-level ERROR >>"$LOGDIR/cloud-$STAMP.log" 2>>"$LOGDIR/cloud-$STAMP.err"; then
        echo "     ✅ 已上雲：$CLOUD_REM/$C_TAG.tar"
        printf '✅ %s\t通過 %s\t唔對 0\t唔見 0\tbytes %s\n' "$C_D" "$C_O" "$C_BY" >> "$C_REP"
        touch "$CLOUD_TMP/_done/$C_TAG"
        C_OK=$((C_OK+1)); C_BYTES=$((C_BYTES+C_BY))
      else
        echo "     ❌ 上傳失敗 → 保留本地 tar，下次可重傳"
        printf '❌上傳失敗\t%s\n' "$C_D" >> "$C_REP"
        C_BAD=$((C_BAD+1))
        continue
      fi
      rm -f "$C_TAR"
      df -h "$CLOUD_TMP" 2>/dev/null | tail -1 | awk '{print "     💾 暫存碟 剩 "$4}'
    done
    unset C_PW
    cm_close
    echo
    C_OK=$(grep -c '^✅' "$C_REP" 2>/dev/null || echo 0)
    C_BAD=$(grep -cE '^(❗|❌|⚠️)' "$C_REP" 2>/dev/null || echo 0)
    C_DONE=$(ls -1 "$CLOUD_TMP/_done" 2>/dev/null | wc -l | tr -d ' ')
    C_BYTES=$(awk -F'\t' '/^✅/{b=$NF; sub("bytes ","",b); s+=b} END{printf "%d", s+0}' "$C_REP" 2>/dev/null)
    echo "  ═════════ 雲端救援總結 ═════════"
    echo "  ✅ 成功上雲 : $C_OK 格（累計標記 $C_DONE 格）"
    echo "  ❌ 有問題   : $C_BAD 格"
    echo "  📦 已上雲量 : $(( ${C_BYTES:-0} / 1073741824 )) GB"
    echo "  📄 報告     : $C_REP"
    echo "  ☁️  雲端位置 : $CLOUD_REM"
    echo "  ═══════════════════════════════"
    exit 0
    ;;

  status)
    # ⭐ 早上總覽：唔連 NAS、唔問密碼
    echo "  ══════════ 還原進度總覽（本機，唔會連 NAS）══════════"
    echo
    echo "  ── 1. 外置碟／卷空間 ──────────────────────"
    for _V in /Volumes/*; do
      [ -d "$_V" ] || continue
      case "$_V" in */synology*) continue ;; esac
      _D=$(df -h "$_V" 2>/dev/null | tail -1 | awk '{print $3" 已用 / "$4" 可用 / "$2" 總"}')
      printf "  %-34s %s\n" "$(basename "$_V")" "$_D"
    done
    echo
    echo "  ── 2. 已還原總量（由驗收報告加總，唔掃碟）─────"
    _ALLR=$(ls -t "$LOGDIR"/auto-*.report.txt 2>/dev/null)
    _R=$(printf '%s\n' "$_ALLR" | head -1)   # 最新一份（＝真實最終狀態）
    _R5=$(printf '%s\n' "$_ALLR" | head -5)  # 只作檔案列表顯示
    if [ -z "$_R" ]; then
      echo "  （未搵到自動報告）"
    else
      awk -F'\t' '
        /^✅/ { n++; b=$NF; sub("bytes ","",b); s+=b }
        /^跳過/ { k++ }
        /^⚠️/  { m++ }
        END { printf "  （最新一份：%s）\n     ✅ 完成 %d 格 ／ ⏭️ 跳過 %d 格 ／ ⚠️ 冇資料 %d 格 ／ 📦 %.1f GB\n", FILENAME, n, k, m, s/1073741824 }
      ' "$_R"
      echo
      echo "  ── 3. 自動報告（最近 5 個）──"
      printf '%s\n' "$_R" | sed 's/^/     /'
    fi
    echo
    echo "  ── 4. 已完成標記（重跑時會自動跳過）──────────"
    for _M in "$HOME"/recovered/_done /Volumes/*/recovered/_done /Volumes/*/*/recovered/_done; do
      [ -d "$_M" ] || continue
      echo "     $_M ：$(ls -1 "$_M" 2>/dev/null | wc -l | tr -d ' ') 格"
    done
    echo
    echo "  ── 5. 有問題嘅格（要重做）──────────────────"
    if [ -n "$_R" ]; then
      _BAD=$(awk -F'\t' '
        function num(x,  a){ split(x,a," "); return a[2]+0 }
        /^⚠️/ { print "     ⚠️ 冇資料（下次自動重做）: " $2 }
        /^✅/ { if (num($3)>0 || num($4)>0) print "     ❗ " $1 "  唔對=" num($3) "  唔見=" num($4) }
      ' "$_R")
      if [ -n "$_BAD" ]; then printf '%s\n' "$_BAD"; else echo "     ✅ 冇任何問題格"; fi
    fi
    echo
    echo "  ── 6. 跳過（空間不足）清單 ─────────────────"
    if [ -n "$_R" ]; then
      _SK=$(awk -F'\t' '/^跳過/ {print "     ⏭️  " $2}' "$_R" | sort -u)
      if [ -n "$_SK" ]; then printf '%s\n' "$_SK"; else echo "     （冇）"; fi
    fi
    echo
    echo "  ══════════════════════════════════════════════"
    echo "  ➜ 把以上全部掟返俾 Hermes，我幫你決定下一步。"
    echo
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
  cloud [暫存目錄] [遙端]      ★★ 純雲救援：NAS→Drive（逐檔核 SHA-256 後才上傳）
  status                       ★ 早上總覽（唔連 NAS、唔問密碼）
  auto [目的地]                ★★ 無人值守：一次密碼→自動還原全部→逐批驗收
                              （有續跑功能：已完整還原嘅資料夾會自動跳過）
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
  cm_setup
  echo
  printf "  🔑 NAS sudo 密碼（唔會顯示、唔會寫入磁碟）："
  read -r -s A_PW
  echo; echo
  if ! printf '%s\n' "$A_PW" | rssh "sudo -S -p '' true" 2>/dev/null; then
    echo "  ❌ 密碼唔啱或連唔上 NAS —— 中止，冇改動過任何嘢。"
    unset A_PW; exit 1
  fi
  echo "  ✅ 密碼正確"
  echo
  echo "  ⚠️  之後請【唔好關呢個 Terminal 視窗、唔好熄機、唔好拔線】"
  echo "  ⚠️  想安全中斷：按 Control-C（已還原嘅檔唔會消失，可續跑）"
  echo
  # 防止 Mac 休眠
  caffeinate -i -s -w $$ 2>/dev/null &
  FB_CAFF=$!
  # 取批次清單：由細至大，排除 #recycle / sparsebundle / @eaDir
  # 排除清單（Dickson 指定：唔要 #recycle、唔要 iPhone／iMac 時光機備份）
  A_EXCL='#recycle|sparsebundle|MobileSync|Time Machine|TimeMachine|iPhone|iPad|iTunes|iDevice|/Backup/$'
  # ⚠️ sudo 要密碼（stdin）—— 之前漏咗餵 → sudo 靜靜失敗 → 清單空白
  A_ALL=$(printf '%s\n' "$A_PW" | rssh "sudo -S -p '' sh -c \"cd '$SHARE' && du -sk */ 2>/dev/null\"" 2>/dev/null | grep -vE '@eaDir')
  if [ -z "$A_ALL" ]; then
    echo "  ⚠️ 攞唔到清單，即刻診斷："
    printf '%s\n' "$A_PW" | rssh "sudo -S -p '' sh -c \"cd '$SHARE' && echo '--- ls ---'; ls -1 './' | head -8; echo '--- du ---'; du -sk ./*/ 2>&1 | head -5\"" 2>&1 | head -20
    echo
    echo "  ❌ 仍然攞唔到資料夾清單 —— 把上面診斷掟返俾 Hermes。"
    unset A_PW; cm_close; exit 1
  fi
  A_DROP=$(printf '%s\n' "$A_ALL" | grep -Ei "$A_EXCL")
  A_LIST=$(printf '%s\n' "$A_ALL" | grep -Eiv "$A_EXCL" | sort -n)
  echo "  🚫 排除清單（唔會還原）："
  if [ -n "$A_DROP" ]; then
    printf '%s\n' "$A_DROP" | while IFS=$'\t' read -r k d; do echo "       ✗ $d  （$((k/1048576)) GB）"; done
  else
    echo "       （今次冇剔除任何目錄）"
  fi
  echo
  if [ -z "$A_LIST" ]; then echo "  ❌ 攞唔到資料夾清單"; unset A_PW; exit 1; fi
  A_TOTAL=$(printf '%s\n' "$A_LIST" | grep -c .)
  echo "  📋 共 ${A_TOTAL} 個資料夾（由細至大處理）"
  echo

  A_N=0; A_OK=0; A_BAD=0; A_MISS=0; A_BYTES=0; A_SKIP=0; A_DONE=0
  A_MARKDIR="$DEST/_done"; mkdir -p "$A_MARKDIR" 2>/dev/null
  while IFS=$'\t' read -r A_KB A_DIR; do
    [ -z "$A_DIR" ] && continue
    A_N=$((A_N+1))
    A_TAG=$(printf '%s' "$A_DIR" | tr -d '/' | tr ' ' '_')
    # 檢查持久連線（macOS 睡醒後可能斷）
    if [ -n "$FB_SSH_SOCK" ] && ! ssh -S "$FB_SSH_SOCK" -O check "$TARGET" >/dev/null 2>&1; then
      echo "     🔄 持久連線斷咗 → 嘗試重建…"
      if ssh -S "$FB_SSH_SOCK" -o ControlPersist=12h -o BatchMode=yes -o ConnectTimeout=15 -fN "$TARGET" 2>/dev/null; then
        echo "     ✅ 連線已重建"
      else
        echo "     ⚠️ 重建失敗（可能睡過機）→ 之後每格都要重新登入；建議 Control-C 重跑"
      fi
    fi
    if [ -f "$A_MARKDIR/$A_TAG" ]; then
      A_DONE=$((A_DONE+1))
      echo "  [已還原，跳過] $A_DIR"
      continue
    fi
    # ⚠️ 單位鐵律：du -sk 同 df -k 都係 KB。A_NEED 必須係 KB（×1.1 安全邊際）。
    A_NEED=$(( A_KB * 11 / 10 + 1024 ))
    A_FREE=$(df -k "$DEST" 2>/dev/null | tail -1 | awk '{print $4}')
    [ -z "$A_FREE" ] && A_FREE=0
    echo "  ────────────────────────────────────────────────────────"
    echo "  [${A_N}/${A_TOTAL}] $A_DIR"
    echo "     需要約 $((A_KB/1024)) MB   ／   剩餘 $((A_FREE/1048576)) GB"
    if [ "$A_FREE" -lt "$A_NEED" ]; then
      echo "     ⏭️  空間不足 → 跳過（留待插第二隻碟再跑）"
      A_SKIP=$((A_SKIP+1))
      printf '跳過(空間不足)\t%s\n' "$A_DIR" >> "$REP"
      continue
    fi
    A_DQ=$(sq "$SHARE/$A_DIR")
    A_R="python3 $TOOL extract '$A_DQ' --g 23082"
    printf '%s\n' "$A_PW" | rssh "sudo -S -p '' sh -c \"$A_R\"" 2>>"$ERRF" \
      | tar -xf - -C "$DEST" 2>>"$ERRF"
    A_MAN="$DEST/_c3r_manifest.jsonl"
    if [ ! -f "$A_MAN" ]; then
      echo "     🔄 今次冇收到資料 → 自動重試一次…"
      printf '%s\n' "$A_PW" | rssh "sudo -S -p '' sh -c \"$A_R\"" 2>>"$ERRF" \
        | tar -xf - -C "$DEST" 2>>"$ERRF"
    fi
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
      # 只有「完全乾淨」才落 marker（有唔對／唔見 = 下次要重做）
      if [ "$B_BAD" -eq 0 ] && [ "$B_MISS" -eq 0 ]; then touch "$A_MARKDIR/$A_TAG"; fi
      rm -f "$A_MAN"
    else
      echo "     ⚠️ 冇 manifest，跳過核對"
      printf '⚠️ 冇manifest\t%s\n' "$A_DIR" >> "$REP"
    fi
  done < <(printf '%s\n' "$A_LIST")

  unset A_PW
  cm_close
  echo
  echo "  ══════════════════ 最終驗收報告 ══════════════════"
  echo "  📁 處理資料夾    ：${A_N} / ${A_TOTAL}"
  echo "  ⏭️  之前已完成    ：$A_DONE 個（自動跳過，唔會重複搬）"
  echo "  ⏭️  空間不足跳過  ：$A_SKIP 個（下次插新碟再跑會自動補做）"
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
  cm_setup
  echo
  printf "  🔑 NAS sudo 密碼（唔會顯示、唔會記錄）："
  read -r -s SUDOPW
  echo
  echo "  ⬇️  串流還原中…（大檔可能要幾分鐘）"
  echo
  printf '%s\n' "$SUDOPW" | rssh "${SUDO} -S -p '' sh -c \"$REMOTE\"" 2>"$LOGDIR/${TASK}-${STAMP}.err" | tar -xf - -C "$DEST" 2>>"$LOGDIR/${TASK}-${STAMP}.err"
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
