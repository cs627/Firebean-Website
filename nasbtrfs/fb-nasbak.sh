#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  Firebean 本機 NAS 備份 —— 一鍵工具（全程單向，只讀來源）
#
#  用途：將已經救返嘅資料，由 ExternalSSD 複製去【另一部新 NAS】
#        （經 Finder 掛載嘅網絡磁碟），做第二份本機備份。
#        —— 比上雲快（行 LAN，行到 125～312 MB/s；上雲多數得 12.5 MB/s）。
#
#  用法（喺 Mac 嘅 Terminal 貼）：
#        bash ~/fb-nasbak.sh list                ① 睇有咩掛載點（邊個係新 NAS）
#        bash ~/fb-nasbak.sh start [目的地] [來源] ② 開始複製（背景跑，可關窗）
#        bash ~/fb-nasbak.sh status              ③ 睇進度
#        bash ~/fb-nasbak.sh check               ④ 核對檔案數同大細
#        bash ~/fb-nasbak.sh stop                ⑤ 停
#
#  ⚠️ 來源 /Volumes/ExternalSSD/dicksonimac/recovered 係目前唯一一份救回資料。
#     本工具只會【讀】來源，永遠唔會刪／改／移動來源。
#     亦永遠唔會用 rsync 嘅刪除選項，確保係單向複製，唔會雙向同步。
# ═══════════════════════════════════════════════════════════════
set -uo pipefail

VERSION="fb-nasbak-20261031-1700"
BUILD=3

# ─────────────────────────────────────────────────────────────
# 主要路徑（全部可由環境覆寫 —— 只為測試用；正式跑唔需要改）
# ─────────────────────────────────────────────────────────────
VOLUMES_DIR="${FB_VOLUMES_DIR:-/Volumes}"
EXTERNAL_DISK="${FB_EXTERNAL_DISK:-${VOLUMES_DIR}/ExternalSSD}"
SRC_CANON="${FB_SRC_CANON:-${EXTERNAL_DISK}/dicksonimac/recovered}"
SRC_DEFAULT="${FB_SRC_DEFAULT:-${SRC_CANON}}"
LOGDIR="${FB_LOGDIR:-$HOME/fb-nasbak-logs}"
# 假 mount 輸出（mock 測試用）；正式跑留空 → 用系統 mount
MOUNT_FILE="${FB_MOUNT_FILE:-}"

# ─────────────────────────────────────────────────────────────
# 自我識別：呢個係 macOS 專用工具（caffeinate、Finder 掛載網絡磁碟）
#   FB_ALLOW_NONMAC=1 只為離線 mock 測試放行；正式跑唔應該設。
# ─────────────────────────────────────────────────────────────
if [ "$(uname -s 2>/dev/null)" != "Darwin" ] && [ "${FB_ALLOW_NONMAC:-0}" != "1" ]; then
  echo "  ⛔ 呢句要喺 Mac（macOS）嘅 Terminal 跑 —— 呢部機唔係 Mac。"
  echo
  echo "     本工具用到 macOS 專屬嘅 caffeinate，同埋 Finder 掛載嘅網絡磁碟。"
  echo "     請返去 Mac 嘅 Terminal，貼："
  echo "         bash ~/fb-nasbak.sh list"
  exit 3
fi

banner() {
  echo "════════════════════════════════════════════════════"
  echo "  Firebean 本機 NAS 備份（${1}）"
  echo "  版本：${VERSION}  ／  BUILD ${BUILD}"
  echo "════════════════════════════════════════════════════"
}

# ─────────────────────────────────────────────────────────────
# 工具函式
# ─────────────────────────────────────────────────────────────
# 千分位逗號（例如 1230000 → 1,230,000）
commas() {
  awk -v n="$1" 'BEGIN{
    s=sprintf("%d", n); r="";
    while (length(s) > 3) { r="," substr(s, length(s)-2) r; s=substr(s, 1, length(s)-3) }
    print s r
  }'
}

# 讀 mount 資料（mock 測試可傳檔覆寫）
mount_data() {
  if [ -n "${MOUNT_FILE}" ]; then
    cat "${MOUNT_FILE}"
  else
    mount
  fi
}

# 取得某路徑所屬掛載點嘅檔案系統類型（取最長前綴比對）
#   macOS 格式：來源 on 掛載點 (fstype, opts, ...)
mount_fstype() {
  local path="$1" best="" bestlen=-1 line mnt ft
  while IFS= read -r line; do
    case "$line" in
      *" on "*" ("*) : ;;
      *) continue ;;
    esac
    mnt=$(printf '%s' "$line" | sed -E 's/.* on (.*) \(.*/\1/')
    ft=$(printf '%s' "$line" | sed -E 's/.* \((.*)\).*/\1/' | cut -d, -f1 | tr -d ' ')
    case "$path" in
      "$mnt"|"$mnt"/*)
        if [ "${#mnt}" -gt "$bestlen" ]; then best="$ft"; bestlen="${#mnt}"; fi
        ;;
    esac
  done < <(mount_data)
  printf '%s' "${best:-未知}"
}

# 是否網絡掛載（afp / smb / nfs / webdav / ftp…）
is_network_fs() {
  case "$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')" in
    afp*|smb*|cifs*|nfs*|webdav*|ftp*|sftp*) return 0 ;;
    *) return 1 ;;
  esac
}

# ─────────────────────────────────────────────────────────────
# rsync 進度旗標 —— macOS 內建 rsync 係 2.6.9（2006 年），
# 唔支援 --info=progress2（rsync 3.x 才有）。用錯會即刻
# 印出 usage 並失敗，用戶只會見到一堆選項清單。
#
# ⚠️ 唔可以靠解析 --version 字串判斷：字串係
#    "rsync  version 2.6.9  protocol version 29"
#    貪心 regex 會捉到最後一個數字（29）而誤判成新版本。
#    改為直接探測 rsync 認唔認得呢個旗標。
# ─────────────────────────────────────────────────────────────
if rsync --info=progress2 --version >/dev/null 2>&1; then
  RSYNC_PROGRESS="--info=progress2"
else
  RSYNC_PROGRESS="--progress"
fi
# 一律包含 --partial → 呢個 pattern 喺 2.6.9 同 3.x 都存在，可用嚟認返自己嘅 job
RSYNC_MATCH='rsync -a .*--partial'

# 自動偵測目的地：$VOLUMES_DIR 下、非 ExternalSSD、且係網絡掛載嘅掛載點
detect_dest() {
  local v ft out=""
  # 第一優先：網絡掛載（新 NAS 經 Finder 掛載）
  for v in "$VOLUMES_DIR"/*; do
    [ -e "$v" ] || continue
    case "$v" in
      "$EXTERNAL_DISK") continue ;;
    esac
    ft=$(mount_fstype "$v")
    if is_network_fs "$ft"; then
      out="${out}${v}"$'\n'
    fi
  done
  [ -n "$out" ] && { printf '%s' "$out"; return; }

  # 第二優先：本機外接卷（USB 硬碟盒）
  for v in "$VOLUMES_DIR"/*; do
    [ -e "$v" ] || continue
    case "$v" in
      "$EXTERNAL_DISK") continue ;;
      "$VOLUMES_DIR/Macintosh HD") continue ;;
      "$VOLUMES_DIR/Recovery") continue ;;
      "$VOLUMES_DIR/com.apple.TimeMachine"*) continue ;;
      "$VOLUMES_DIR/.timemachine") continue ;;
    esac
    [ -d "$v" ] || continue
    out="${out}${v}"$'\n'
  done
  printf '%s' "$out"
}

# ─────────────────────────────────────────────────────────────
# 任務驗證（未知 → 明確報錯 exit 2）
# ─────────────────────────────────────────────────────────────
TASK="${1:-help}"
case "$TASK" in
  list|start|status|check|stop|help) : ;;
  *)
    echo "  ❌ 冇呢個任務：「${TASK}」"
    echo
    echo "  可用任務：list / start / status / check / stop / help"
    echo
    echo "  打「bash ~/fb-nasbak.sh help」睇詳細用法。"
    exit 2
    ;;
esac

if [ "$TASK" = "help" ]; then
  cat <<'EOF'
Firebean 本機 NAS 備份（全程單向，只讀來源）

用法（喺 Mac 嘅 Terminal 貼）：

  bash ~/fb-nasbak.sh list                 睇 /Volumes 下所有掛載點（邊個係新 NAS）
  bash ~/fb-nasbak.sh start [目的地] [來源]
                                           開始複製（唔指定目的地會自動偵測）
  bash ~/fb-nasbak.sh status               睇進度
  bash ~/fb-nasbak.sh check                核對來源同目的地檔案數／總大細
  bash ~/fb-nasbak.sh stop                 停（已複製嘅唔會消失，可續傳）

預設來源：/Volumes/ExternalSSD/dicksonimac/recovered（★ 只讀，永不刪改）
複製方法：rsync -a（進度顯示自動配合系統 rsync 版本）--partial（單向、可續傳、保留時間戳）
記錄檔　：~/fb-nasbak-logs/

⚠️ 完成後：勿刪來源，最少留兩份；新 NAS 最好備份完即離線／斷網。
EOF
  exit 0
fi

# ─────────────────────────────────────────────────────────────
# 記錄檔（任務名 + 時間戳；全部輸出同時 tee 落去）
# ─────────────────────────────────────────────────────────────
mkdir -p "${LOGDIR}" 2>/dev/null
STAMP=$(date '+%Y%m%d-%H%M%S')
LOG="${LOGDIR}/${TASK}-${STAMP}.txt"
RUNLOG="${LOGDIR}/copy.log"
: > "${LOG}"
exec > >(tee -a "${LOG}") 2>&1

# ─────────────────────────────────────────────────────────────
# 安全硬檢查（寫入任何嘢之前就做）
#   ★ 只讀來源；目的地必須係另一處、非空、唔等於／唔喺來源之內
# ─────────────────────────────────────────────────────────────
safety_check() {
  local src="$1" dest="$2"
  # 去掉尾斜線方便比對（唔動真路徑，只做比對用）
  local s="${src%/}" d="${dest%/}"

  # ① 來源必須存在
  if [ ! -d "${src}" ]; then
    echo "  ❌ 來源必須存在 —— 搵唔到：${src}"
    echo "     （救回資料通常喺：${SRC_CANON}）"
    exit 1
  fi
  # ② 來源必須係指定嘅救回資料夾
  if [ "${s}" != "${SRC_CANON%/}" ]; then
    echo "  ❌ 來源必須係：${SRC_CANON}"
    echo "     （你俾咗：${src}）—— 為安全起見，只准複製呢一個救回資料夾。"
    exit 1
  fi
  # ③ 目的地不可為空
  if [ -z "${dest}" ] || [ -z "${d}" ]; then
    echo "  ❌ 目的地不可為空。"
    exit 2
  fi
  # ④ 目的地不可等於來源（★ 先於「喺來源底下」檢查，訊息更清楚）
  if [ "${d}" = "${s}" ]; then
    echo "  ❌ 拒絕：目的地唔可以等於來源（同一個路徑：${dest}）。"
    exit 2
  fi
  # ⑤ 目的地不可係來源嘅子目錄
  case "${d}" in
    "${s}"/*)
      echo "  ❌ 拒絕：目的地唔可以係來源嘅子目錄（你俾咗：${dest}）。"
      echo "     目的地要係另一部 NAS，唔係來源裡面。"
      exit 2
      ;;
  esac
  # ⑥ 目的地不可位於 ExternalSSD 底下（同一隻碟 = 唔算備份）
  case "${d}" in
    "${EXTERNAL_DISK}"|"${EXTERNAL_DISK}"/*)
      echo "  ❌ 拒絕：目的地唔可以喺來源同一個磁碟（${EXTERNAL_DISK}）底下。"
      echo "     同一隻碟出事會一齊冇，等於冇備份。"
      exit 2
      ;;
  esac
}

# 目的地係本機非網絡碟 → 警告並要求打 yes（非互動時唔會自動前進）
local_disk_guard() {
  local dest="$1" ft
  ft=$(mount_fstype "${dest}")
  if is_network_fs "${ft}"; then
    echo "  ✅ 目的地係網絡掛載（${ft}）"
    return 0
  fi
  echo "  ⚠️  警告：目的地（${dest}）睇落係本機碟（檔案系統：${ft}），唔似網絡 NAS。"
  echo "     備份去本機碟唔算異地備份；上一之中毒，Hyper Backup／USB 備份碟都一齊被加密。"
  echo
  if [ ! -t 0 ]; then
    echo "  ⏹  而家唔係互動模式（冇 Terminal 可以打 yes）→ 唔會自動前進，已中止。"
    echo "     如真的要備份去本機碟：喺 Terminal 直接跑，並打 yes 確認。"
    exit 1
  fi
  printf "  ❓ 確定要備份去呢個本機碟？要打 yes 先會繼續："
  read -r ANS
  case "${ANS}" in
    yes|YES|Yes) echo "  ✅ 已確認，繼續。" ;;
    *)
      echo "  ⏹  已取消，冇複製任何嘢。"
      exit 1
      ;;
  esac
}

# ─────────────────────────────────────────────────────────────
# list：列出掛載點、標本機／網絡、可用空間
# ─────────────────────────────────────────────────────────────
list_run() {
  banner "掛載點清單"
  echo "  ── ${VOLUMES_DIR} 下嘅掛載點 ──"
  echo
  local v ft kind free
  for v in "$VOLUMES_DIR"/*; do
    [ -e "$v" ] || continue
    ft=$(mount_fstype "$v")
    if is_network_fs "$ft"; then
      kind="🟦 網絡 NAS（${ft}）"
    else
      kind="💽 本機碟（${ft}）"
    fi
    case "$v" in
      "$EXTERNAL_DISK")     kind="${kind}  ← 救回資料來源（只讀，勿動）" ;;
      *"/Macintosh HD")     kind="${kind}  ← 系統碟" ;;
    esac
    free=$(df -h "$v" 2>/dev/null | awk 'NR==2{print $4}')
    printf '  %-46s %s\n' "$v" "$kind"
    printf '  %-46s   可用空間：%s\n' "" "${free:-（讀唔到）}"
  done
  echo
  echo "  ▶ 提示：新 NAS 應該顯示【🟦 網絡 NAS】。"
  echo "         若係 NFS 手動掛載，可能唔喺 ${VOLUMES_DIR} 之下。"
  echo
  echo "  👉 下一步：bash ~/fb-nasbak.sh start"
}

# ─────────────────────────────────────────────────────────────
# start
# ─────────────────────────────────────────────────────────────
start_run() {
  banner "開始本機 NAS 備份"
  local DEST="${1:-}"
  local SRC="${2:-${SRC_DEFAULT}}"

  # 冇指定目的地 → 自動偵測
  if [ -z "${DEST}" ]; then
    echo "  🔎 未指定目的地 → 自動偵測 ${VOLUMES_DIR} 下嘅網絡 NAS…"
    local CAND N
    CAND=$(detect_dest)
    N=$(printf '%s' "${CAND}" | grep -c . 2>/dev/null || true)
    if [ "${N}" -eq 0 ] 2>/dev/null; then
      echo "  ❌ 搵唔到任何網絡掛載嘅目的地。"
      echo "     請先喺 Finder 連上新 NAS，或者自己指定："
      echo "         bash ~/fb-nasbak.sh start /Volumes/你嘅新NAS/備份夾"
      exit 2
    fi
    if [ "${N}" -ge 2 ] 2>/dev/null; then
      echo "  ⚠️  偵測到多過一個網絡掛載 —— 為免亂揀，請你自己指定其中一個："
      printf '%s' "${CAND}" | sed 's/^/         /'
      echo
      echo "         bash ~/fb-nasbak.sh start <上面其中一個>/備份夾"
      exit 2
    fi
    DEST=$(printf '%s' "${CAND}" | head -1)
    echo "  ✅ 自動揀到目的地：${DEST}"
  fi

  # ── 安全硬檢查（寫入任何嘢之前）──
  safety_check "${SRC}" "${DEST}"
  local_disk_guard "${DEST}"

  echo
  echo "  來源     ：${SRC}   （★ 只讀，永不刪改）"
  echo "  目的地   ：${DEST}"
  echo "  複製方法 ：rsync -a ${RSYNC_PROGRESS} --partial（單向、可續傳、保留時間戳）"
  echo

  # ── 預估時間（讀實際來源大細）──
  echo "  📏 讀取來源大細（1.2 TB 可能要幾分鐘，請耐心）…"
  local KB SIZE_MB
  KB=$(du -sk "${SRC}" 2>/dev/null | awk '{print $1}')
  KB="${KB:-0}"
  SIZE_MB=$(awk -v kb="${KB}" 'BEGIN{printf "%d", kb/1024}')
  echo
  awk -v mb="${SIZE_MB}" '
    function comma(n,  s,r){ s=sprintf("%d",n); r="";
      while(length(s)>3){ r="," substr(s,length(s)-2) r; s=substr(s,1,length(s)-3) } return s r }
    BEGIN{
      printf "  📏 來源大細：約 %s MB（約 %.2f TB）\n", comma(mb), mb/1024/1024
      printf "  ⏱  預估時間（實際視乎 LAN 線材、NAS 硬碟同網絡負載）：\n"
      printf "      • 1 Gbps LAN  ：%s MB ÷ 125 MB/s ≈ %.1f 小時\n", comma(mb), mb/125/3600
      printf "      • 2.5 Gbps LAN：%s MB ÷ 312 MB/s ≈ %.1f 小時\n", comma(mb), mb/312/3600
      printf "      • 100 Mbps 上傳：%s MB ÷ 12.5 MB/s ≈ %.1f 小時（呢個就係上雲要等嘅時間）\n", comma(mb), mb/12.5/3600
    }'
  echo

  mkdir -p "${LOGDIR}" || exit 1
  if pgrep -f 'rsync .*fb-nasbak' >/dev/null 2>&1 || pgrep -f 'fb-nasbak-copy' >/dev/null 2>&1; then
    echo "  ⚠️  已經有複製喺度跑緊。睇進度：bash ~/fb-nasbak.sh status"
    exit 0
  fi

  echo "  🚚 開始複製（背景執行 —— 可以關 Terminal 窗）"
  echo "  ⚠️  但請唔好熄機、唔好拔線、唔好 eject 網絡磁碟"
  echo "  ⚠️  想停止：bash ~/fb-nasbak.sh stop（已複製嘅唔會消失，可續傳）"
  echo
  # ★ 注意：全程只讀來源；唔用任何刪除選項；唔做雙向同步
  nohup caffeinate -i -s rsync -a ${RSYNC_PROGRESS} --partial --human-readable \
    --stats "${SRC}/" "${DEST}/" \
    > "${RUNLOG}" 2>&1 &
  # 記住目的地，方便 status 同 check（唔靠 tail log 猜）
  printf '%s\n' "${DEST}" > "${LOGDIR}/dest.path"
  printf '%s\n' "${SRC}"  > "${LOGDIR}/src.path"
  sleep 8
  if pgrep -f 'rsync .*fb-nasbak' >/dev/null 2>&1 || pgrep -f "${RSYNC_MATCH}" >/dev/null 2>&1; then
    echo "  ✅ 複製已經開始（背景跑緊）"
    echo
    echo "  📊 而家嘅進度："
    tail -3 "${RUNLOG}" 2>/dev/null | sed 's/^/     /'
    echo
    echo "  👉 隨時打：bash ~/fb-nasbak.sh status"
  else
    echo "  ⚠️ 啟動失敗 —— 睇記錄："
    tail -20 "${RUNLOG}" 2>/dev/null | sed 's/^/     /'
    exit 1
  fi
}

# ─────────────────────────────────────────────────────────────
# status
# ─────────────────────────────────────────────────────────────
status_run() {
  banner "複製進度"
  local DEST SRC
  DEST=$(cat "${LOGDIR}/dest.path" 2>/dev/null || true)
  SRC=$(cat "${LOGDIR}/src.path" 2>/dev/null || true)
  if pgrep -f "${RSYNC_MATCH}" >/dev/null 2>&1; then
    echo "  🟢 狀態：複製中"
  else
    echo "  ⚪ 狀態：冇跑緊（已完成 或 已停止）"
  fi
  echo
  echo "  ── 最近記錄 ──"
  tail -5 "${RUNLOG}" 2>/dev/null | sed 's/^/     /' || echo "     （冇記錄檔）"
  echo
  echo "  ── 目的地 ──"
  if [ -n "${DEST}" ]; then
    echo "     路徑：${DEST}"
    df -h "${DEST}" 2>/dev/null | sed 's/^/     /'
    du -sh "${DEST}" 2>/dev/null | awk '{print "     已複製約：" $1}'
  else
    echo "     （未開始過）"
  fi
  echo
  echo "  ── 來源（只讀，作對照）──"
  [ -n "${SRC}" ] && du -sh "${SRC}" 2>/dev/null | awk '{print "     " $1}' || true
}

# ─────────────────────────────────────────────────────────────
# check：比對來源與目的地檔案數同總大細
# ─────────────────────────────────────────────────────────────
check_run() {
  banner "核對（來源 vs 目的地）"
  local DEST SRC
  DEST=$(cat "${LOGDIR}/dest.path" 2>/dev/null || true)
  SRC=$(cat "${LOGDIR}/src.path" 2>/dev/null || true)
  SRC="${SRC:-${SRC_DEFAULT}}"
  if [ -z "${DEST}" ]; then
    echo "  ❌ 未知目的地（未開始過複製）。"
    exit 1
  fi
  echo "  來源  ：${SRC}"
  echo "  目的地：${DEST}"
  echo
  echo "  🔎 數緊檔案（大檔多時會慢，請耐心）…"
  local SCF DCF SF DF
  SCF=$(find "${SRC}" -type f 2>/dev/null | wc -l | tr -d ' ')
  DCF=$(find "${DEST}" -type f 2>/dev/null | wc -l | tr -d ' ')
  SF=$(du -sk "${SRC}" 2>/dev/null | awk '{print $1}')
  DF=$(du -sk "${DEST}" 2>/dev/null | awk '{print $1}')
  printf '  %-28s %s\n' "來源檔案數：" "${SCF}"
  printf '  %-28s %s\n' "目的地檔案數：" "${DCF}"
  printf '  %-28s %s KB\n' "來源總大細：" "${SF:-0}"
  printf '  %-28s %s KB\n' "目的地總大細：" "${DF:-0}"
  echo
  if [ "${SCF}" = "${DCF}" ] && [ "${SF:-0}" = "${DF:-0}" ]; then
    echo "  ✅ 完全一致：檔案數同總大細都一模一樣。"
  else
    echo "  ⚠️ 未完全一致 —— 可能仲跑緊複製。等跑完再 check 一次。"
  fi
}

# ─────────────────────────────────────────────────────────────
# stop
# ─────────────────────────────────────────────────────────────
stop_run() {
  banner "停止複製"
  if pkill -f "${RSYNC_MATCH}" 2>/dev/null; then
    echo "  ✅ 已停止"
    echo "  ✅ 已複製嘅檔唔會消失；下次跑 start 會自動續傳（--partial）"
  else
    echo "  ⚪ 冇複製喺度跑"
  fi
}

# ─────────────────────────────────────────────────────────────
# 派工
# ─────────────────────────────────────────────────────────────
case "$TASK" in
  list)   list_run ;;
  start)  start_run "${2:-}" "${3:-}" ;;
  status) status_run ;;
  check)  check_run ;;
  stop)   stop_run ;;
esac
RC=$?

echo
echo "════════════════════════════════════════════════════"
if [ "${RC:-0}" -eq 0 ] 2>/dev/null; then
  echo "  ✅ 完成"
else
  echo "  ⚠️ 完成但有非零結束碼：${RC}"
fi
echo "  輸出已存檔：${LOG}"
echo "════════════════════════════════════════════════════"
echo
echo "  ➜ 請將上面全部輸出掟返俾 Hermes（或者喺 Discord 上傳呢個檔）："
echo "     ${LOG}"
echo
exit 0

# ═══════════════════════════════════════════════════════════════
# 工具說明（誠實交代）
# ═══════════════════════════════════════════════════════════════
#
# 1) 呢個工具做咩？
#    將 ExternalSSD 上已救回嘅 /Volumes/ExternalSSD/dicksonimac/recovered
#    單向複製去【另一部新 NAS】（經 Finder／SMB／AFP 掛載嘅網絡磁碟），
#    做第二份本機備份。全程只讀來源；唔會刪、唔會改、唔會移動來源。
#
# 2) 為何比上雲快？
#    行 LAN：1 Gbps ≈ 125 MB/s、2.5 Gbps ≈ 312 MB/s。
#    上雲：家用寬頻上傳多數得 100 Mbps ≈ 12.5 MB/s。
#    同樣 1.23 TB：LAN 約 1～2.7 小時；上雲要約 27 小時（差十幾倍）。
#    所以先用 LAN 落一份本機副本最快，之後再慢慢上雲做異地副本。
#
# 3) 為何新 NAS 未必安全？（★ 重點）
#    • 本機副本 ≠ 異地備份。若兩部 NAS 同一間屋、同一條電、同一個網絡，
#      火災、盜竊、水浸、電湧一樣會一齊冇。真正嘅異地備份要放喺唔同地方。
#    • 上次中毒（C3RB3R）之所以連備份都死，係因為備份目標（Hyper Backup 目標
#      同 USB 備份碟）長期【掛住】喺主 NAS 上、有寫入權限 —— 病毒一加密主 NAS，
#      順手將掛住嘅備份一齊加密。備份「在線」就等於一齊陪葬。
#    • rsync 只保檔案時間戳（-a）—— 若中途斷線，下次靠 --partial 續傳；
#      但撞正勒索，一個「舊但齊全」嘅副本，永遠好過一個「新但加密咗」嘅。
#
# 4) 正確嘅新 NAS 備份設計（建議）：
#    • 讓新 NAS 去「拉」（pull），唔好被主 NAS「推」（push）。
#      即：由新 NAS 主動連去主 NAS 讀取，而唔係主 NAS 有權寫入新 NAS。
#    • 主 NAS 畀新 NAS 嘅帳號【只有唯讀權限】——咁主 NAS 一中毒都寫唔入新 NAS。
#    • 新 NAS 用獨立帳號、獨立密碼，唔好同主 NAS 共用。
#    • 最理想：備份完成後，將新 NAS 【離線／斷網】（關機或拔網線），
#      真正嘅離線備份（air-gap）先係勒索病毒攻唔到嘅。
#    • 本工具係「新手第一步」：先快速落一份本機副本（第二份），
#      跟住再做真正嘅異地／離線備份（第三份，最好喺另一個地方）。
#
# 5) 點解安全？
#    • 只讀來源：rsync 只從來源讀，唔會寫／刪來源。
#    • 絕不用任何刪除選項、絕不做雙向同步（唔會用 rsync 嘅 delete 旗標）。
#    • 寫入前硬檢查：來源必須存在且係指定救回資料夾；目的地不可為空、
#      不可等於來源、不可係來源子目錄、不可喺同名磁碟底下。
#    • 目的地若係本機碟 → 印警告，要打 yes 先繼續；非互動模式唔會自動前進。
#    • 完成後提醒：勿刪來源，最少留兩份。
# ═══════════════════════════════════════════════════════════════
