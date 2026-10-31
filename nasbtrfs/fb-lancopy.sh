#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  Firebean LAN 直抄 —— 由救援碟經 gigabit LAN 抄入已重建嘅 NAS
#
#  為何要另一支腳本：fb-nasbak.sh 一次只容許一個 job 跑。
#  8TB USB 盒嘅慢速備份會繼續跑（通宵），所以要一支獨立、
#  可以同佢並存嘅腳本，各自有自己嘅 log 同 stop。
#
#  用法（喺 Mac 嘅 Terminal 貼）：
#        bash ~/fb-lancopy.sh list      ① 睇有咩網絡掛載（邊個係 NAS）
#        bash ~/fb-lancopy.sh start     ② 開始抄（唔指定會自動偵測）
#        bash ~/fb-lancopy.sh status    ③ 睇進度
#        bash ~/fb-lancopy.sh stop      ④ 停
#
#  ⚠️ 來源 /Volumes/ExternalSSD/dicksonimac/recovered 係唯一完整副本。
#     本工具只會【讀】來源，永遠唔會刪／改／移動來源，
#     亦永遠唔會用 rsync 嘅刪除選項（單向複製）。
# ═══════════════════════════════════════════════════════════════
set -uo pipefail

VERSION="fb-lancopy-20261031-1830"
BUILD=1

SRC="${FB_SRC:-/Volumes/ExternalSSD/dicksonimac/recovered}"
VOLUMES_DIR="/Volumes"
LOGDIR="${FB_LOGDIR:-$HOME/fb-lancopy-logs}"
RUNLOG="${LOGDIR}/lan.log"
DESTFILE="${LOGDIR}/dest.path"

# 獨一無二嘅標記：rsync 收到一個永遠配唔到任何檔嘅 exclude 規則。
# 作用係令 pgrep/pkill 可以【只】認返本腳本嘅 job，
# 唔會誤殺 fb-nasbak.sh 正在跑嘅 USB 備份。
MARKER='fb-lancopy-marker-never-matches'

# ─────────────────────────────────────────────────────────────
# 守門：唔係 macOS 就明確報錯（唔好靜靜地做錯事）
# ─────────────────────────────────────────────────────────────
if [ "$(uname -s)" != "Darwin" ]; then
  echo "  ⛔ 呢支腳本要喺 Mac（macOS）嘅 Terminal 跑 —— 呢部機唔係 Mac。"
  exit 1
fi

banner() {
  echo "════════════════════════════════════════════════════════"
  echo "  Firebean LAN 直抄（${1}）"
  echo "  版本：${VERSION}  ／  BUILD ${BUILD}"
  echo "════════════════════════════════════════════════════════"
}

commas() {
  awk -v n="$1" 'BEGIN{
    s=sprintf("%d", n); r="";
    while (length(s) > 3) { r="," substr(s, length(s)-2) r; s=substr(s, 1, length(s)-3) }
    print s r
  }'
}

# ─────────────────────────────────────────────────────────────
# rsync 進度旗標 —— macOS 內建 rsync 係 2.6.9，唔支援 --info=progress2。
# 直接探測，唔可以解析版本字串（會誤讀 protocol version 29）。
# ─────────────────────────────────────────────────────────────
if rsync --info=progress2 --version >/dev/null 2>&1; then
  RSYNC_PROGRESS="--info=progress2"
else
  RSYNC_PROGRESS="--progress"
fi

# ─────────────────────────────────────────────────────────────
# 掛載點工具
# ─────────────────────────────────────────────────────────────
mount_fstype() {
  mount | awk -v p="$1" '
    { for (i=1;i<=NF;i++) if ($i=="on") { mp=$(i+1); if (mp==p) { line=$0 } } }
    END {
      if (line == "") { print ""; exit }
      if (match(line, /\(([^,)]*)/)) print substr(line, RSTART+1, RLENGTH-2)
    }'
}

is_network_fs() {
  case "$1" in
    smbfs|afpfs|nfs|webdav) return 0 ;;
    *) return 1 ;;
  esac
}

detect_dest() {
  local v ft out=""
  for v in "$VOLUMES_DIR"/*; do
    [ -e "$v" ] || continue
    ft=$(mount_fstype "$v")
    if is_network_fs "$ft"; then
      out="${out}${v}"$'\n'
    fi
  done
  printf '%s' "$out"
}

list_run() {
  banner "網絡掛載清單"
  local v ft free
  local found=0
  for v in "$VOLUMES_DIR"/*; do
    [ -e "$v" ] || continue
    ft=$(mount_fstype "$v")
    if is_network_fs "$ft"; then
      found=1
      free=$(df -h "$v" 2>/dev/null | awk 'NR==2{print $4}')
      printf '  %-42s 🟦 網絡（%s）  可用：%s\n' "$v" "$ft" "${free:-（讀唔到）}"
    fi
  done
  if [ "$found" -eq 0 ]; then
    echo "  ⚠️ 而家冇任何網絡掛載。"
    echo "     先喺 Finder 連上 NAS：Finder → 前往 → 連接伺服器 → smb://<NAS_IP>"
  fi
}

start_run() {
  banner "開始 LAN 直抄"
  local DEST="${1:-}"

  if [ ! -d "$SRC" ]; then
    echo "  ❌ 來源唔存在：${SRC}"
    echo "     （救援碟未插／未掛載？）"
    exit 1
  fi

  if [ -z "$DEST" ]; then
    echo "  🔎 未指定目的地 → 自動偵測網絡掛載…"
    local CAND N
    CAND=$(detect_dest)
    N=$(printf '%s' "$CAND" | grep -c . 2>/dev/null || true)
    if [ "${N:-0}" -eq 0 ]; then
      echo "  ❌ 搵唔到任何網絡掛載嘅目的地。"
      echo "     請先喺 Finder 連上 NAS，然後："
      echo "         bash ~/fb-lancopy.sh list"
      exit 2
    fi
    if [ "${N:-0}" -ge 2 ]; then
      echo "  ⚠️ 偵測到多過一個網絡掛載 —— 請自己指定其中一個："
      printf '%s' "$CAND" | sed 's/^/         /'
      echo
      echo "         bash ~/fb-lancopy.sh start <上面其中一個>"
      exit 2
    fi
    DEST=$(printf '%s' "$CAND" | head -1)
    echo "  ✅ 自動揀到目的地：${DEST}"
  fi

  # 安全硬檢查：唔可以係來源本身或其子目錄
  local SRC_REAL DEST_REAL
  SRC_REAL=$(cd "$SRC" 2>/dev/null && pwd -P) || SRC_REAL="$SRC"
  DEST_REAL=$(cd "$DEST" 2>/dev/null && pwd -P) || DEST_REAL="$DEST"
  case "${DEST_REAL}/" in
    "${SRC_REAL}/"*)
      echo "  ⛔ 目的地喺來源裡面（${DEST_REAL}）→ 拒絕，會造成無限遞歸。"
      exit 2
      ;;
  esac
  case "${SRC_REAL}/" in
    "${DEST_REAL}/"*)
      echo "  ⛔ 來源喺目的地裡面 → 拒絕。"
      exit 2
      ;;
  esac
  if [ "$SRC_REAL" = "$DEST_REAL" ]; then
    echo "  ⛔ 來源同目的地係同一個資料夾 → 拒絕。"
    exit 2
  fi

  mkdir -p "$LOGDIR" 2>/dev/null

  # 已經有本腳本嘅 job 跑緊？
  if pgrep -f "$MARKER" >/dev/null 2>&1; then
    echo "  ⚠️ 已經有一個 LAN 直抄喺度跑緊。"
    echo "     睇進度：bash ~/fb-lancopy.sh status"
    echo "     要停　：bash ~/fb-lancopy.sh stop"
    exit 0
  fi

  echo
  echo "  來源     ：${SRC}   （★ 只讀，永不刪改）"
  echo "  目的地   ：${DEST}"
  echo "  複製方法 ：rsync -a ${RSYNC_PROGRESS} --partial（單向、可續傳）"
  echo

  # 大細同 ETA
  echo "  📏 讀取來源大細…"
  local KB SIZE_MB
  KB=$(du -sk "$SRC" 2>/dev/null | awk '{print $1}'); KB="${KB:-0}"
  SIZE_MB=$(awk -v kb="$KB" 'BEGIN{printf "%d", kb/1024}')
  echo "  📏 來源大細：約 $(commas "$SIZE_MB") MB"
  echo "  ⏱  預估（gigabit LAN 70-90 MB/s）："
  awk -v mb="$SIZE_MB" 'BEGIN{
    printf "       • 70 MB/s ：%.1f 小時\n", mb/70/3600
    printf "       • 90 MB/s ：%.1f 小時\n", mb/90/3600
    printf "       • 110 MB/s：%.1f 小時\n", mb/110/3600
  }'
  echo

  echo "  🚚 開始複製（背景執行 —— 可以關 Terminal 窗）"
  echo "  ⚠️  但請唔好熄機、唔好拔線、唔好 eject 救援碟或 NAS"
  echo "  ⚠️  想停止：bash ~/fb-lancopy.sh stop（已複製嘅唔會消失，可續傳）"
  echo

  : > "$RUNLOG"
  printf '%s\n' "$DEST" > "$DESTFILE"
  printf '%s\n' "$SRC"  > "${LOGDIR}/src.path"

  nohup caffeinate -i -s rsync -a ${RSYNC_PROGRESS} --partial --human-readable \
    --stats --exclude="${MARKER}" "${SRC}/" "${DEST}/" \
    > "$RUNLOG" 2>&1 &

  sleep 8
  if pgrep -f "$MARKER" >/dev/null 2>&1; then
    echo "  ✅ 複製已經開始（背景跑緊）"
    echo
    echo "  📊 而家嘅進度："
    tail -3 "$RUNLOG" 2>/dev/null | sed 's/^/     /'
    echo
    echo "  👉 隨時打：bash ~/fb-lancopy.sh status"
  else
    echo "  ⚠️ 啟動失敗 —— 睇記錄："
    tail -20 "$RUNLOG" 2>/dev/null | sed 's/^/     /'
    exit 1
  fi
}

status_run() {
  banner "LAN 直抄進度"
  if pgrep -f "$MARKER" >/dev/null 2>&1; then
    echo "  🟢 狀態：複製中"
  else
    echo "  ⚪ 狀態：冇跑緊"
  fi
  echo

  if [ -s "$RUNLOG" ]; then
    echo "  ── 最近記錄 ──"
    grep -a 'to-check\|to-chk\|xfer#' "$RUNLOG" 2>/dev/null | tail -4 | sed 's/^/     /'
    echo
    echo "  ── 錯誤／警告 ──"
    local errs
    errs=$(grep -aiE '(error|failed|denied|no space|read-only|input/output)' "$RUNLOG" 2>/dev/null \
           | grep -av 'to-check' | tail -6)
    if [ -n "$errs" ]; then printf '%s\n' "$errs" | sed 's/^/     /'; else echo "     （冇錯誤）"; fi
    echo
    # 卡住判定：最近兩個統計樣本時間唔同但位元組數一樣
    local a b
    a=$(grep -a 'to-check' "$RUNLOG" 2>/dev/null | tail -2 | head -1 | awk '{print $1, $2}')
    b=$(grep -a 'to-check' "$RUNLOG" 2>/dev/null | tail -1 | awk '{print $1, $2}')
    if [ -n "$a" ] && [ "$a" = "$b" ]; then
      echo "  ⚠️  進度連續兩次完全一樣 → 可能卡住，睇上面錯誤訊息"
      echo
    fi
  else
    echo "  （冇記錄檔 —— 即係從未開始，打：bash ~/fb-lancopy.sh start）"
    echo
  fi

  if [ -f "$DESTFILE" ]; then
    local d
    d=$(cat "$DESTFILE")
    echo "  ── 目的地 ──"
    echo "     路徑：${d}"
    df -h "$d" 2>/dev/null | sed 's/^/     /'
    echo
  fi
}

stop_run() {
  banner "停止 LAN 直抄"
  if pkill -f "$MARKER" 2>/dev/null; then
    echo "  ✅ 已停止（已複製嘅檔案唔會消失，下次 start 會續傳）"
  else
    echo "  ⚪ 冇跑緊嘅 LAN 直抄"
  fi
}

TASK="${1:-help}"
case "$TASK" in
  list)   list_run ;;
  start)  start_run "${2:-}" ;;
  status) status_run ;;
  stop)   stop_run ;;
  help|*)
    cat <<'EOF'
Firebean LAN 直抄（單向，只讀來源）

  bash ~/fb-lancopy.sh list            睇有咩網絡掛載（邊個係 NAS）
  bash ~/fb-lancopy.sh start [目的地]  開始抄（唔指定會自動偵測網絡掛載）
  bash ~/fb-lancopy.sh status          睇進度
  bash ~/fb-lancopy.sh stop            停（可續傳）

來源：/Volumes/ExternalSSD/dicksonimac/recovered（★ 只讀，永不刪改）
記錄：~/fb-lancopy-logs/lan.log

⚠️ 呢支腳本同 fb-nasbak.sh 可以同時跑（各自有獨立 log 同 stop）。
⚠️ 全程單向複製，冇任何 rsync 刪除選項。
EOF
    ;;
esac
