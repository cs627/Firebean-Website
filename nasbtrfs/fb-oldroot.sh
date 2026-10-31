#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  Firebean 舊 fs-tree 根救援 —— 一鍵工具（全程唯讀）
#
#  用途：針對 NAS 上三個問題資料夾，用 btrfs 舊 fs-tree 根路線搶救：
#        btrfs-find-root -a -o 子卷ID 塊裝置
#        btrfs restore -D -f root_bytenr  （先 dry-run，確認後才真做）
#        ⚠️ 完全唔靠記憶體金鑰；唔寫受害卷；唔刪 .L0CK3D。
#
#  ⚠️ 喺【Mac 嘅 Terminal】執行（唔係喺 NAS 上跑）
#
#      bash ~/fb-oldroot.sh doctor                 環境自檢（第一句先跑）
#      bash ~/fb-oldroot.sh findroot [子卷ID] [塊裝置]
#      bash ~/fb-oldroot.sh restore <root bytenr> [輸出目錄] [路徑正則]
#      bash ~/fb-oldroot.sh scan                   一站式：doctor → findroot → 提示
#
#  失敗三個問題資料夾：
#      [56] O'South ／ [91] ACAN 60A ／ [94] EDB Hong Kong Reading for All Day
# ═══════════════════════════════════════════════════════════════
set -uo pipefail

# 靜默挑一個真存在嘅 UTF-8 locale（唔存在就唔設定，避免 setlocale warning）
for _L in en_US.UTF-8 en_US.utf8 C.UTF-8 zh_HK.UTF-8 UTF-8; do
  if locale -a 2>/dev/null | grep -qx "$_L"; then
    export LC_ALL="$_L" LANG="$_L"; break
  fi
done
unset _L

VERSION="fb-oldroot-20261031-0600"
BUILD=2

NAS_IP="${NAS_IP:-169.254.71.131}"
TARGET="${NAS_USER:-dickson}@${NAS_IP}"
VICTIM_VOL="/volume3"
SHARE="${FB_SHARE:-/volume3/FirebeanShare}"
DEST_DEFAULT="${FB_DEST_DEFAULT:-/volume2/unused-recovered}"
LOGDIR="$HOME/fb-nas-logs"

# 三個問題資料夾（只作提示用）
PROBLEM_DIRS="[56] O'South ／ [91] ACAN 60A ／ [94] EDB Hong Kong Reading for All Day"
# 預設路徑正則 —— 只針對三個問題資料夾（唔係整個 share，避免一次過要幾 TB 空間）
#   O.South 嘅 . 故意代替撇號，避開 shell 引號地獄
#   EDB.* 覆蓋 'EDB "Hong Kong Reading for All Day"' 之類嘅變體
# ⚠️ 若 dry-run 列出 0 個檔 → 即係路徑名同實際唔同 → 請用第 4 個參數自己指定正則
DEFAULT_REGEX='^/(|FirebeanShare/(O.South|ACAN 60A|EDB.*))'

# 可由環境覆寫（測試／特殊情況用；正式跑唔需要設）
SUBVOL_ID="${FB_SUBVOL_ID:-}"
BLOCKDEV="${FB_BLOCKDEV:-}"
# ⚠️ 以下兩個只為 mock 測試才覆寫；正式跑保持預設（偵測真 NAS 標記）
NAS_MARKER_DIRS="${FB_NAS_MARKERS:-/volume1 /volume2}"
SYNOINFO="${FB_SYNOINFO:-/etc/synoinfo.conf}"

# ─────────────────────────────────────────────────────────────
# 自我識別：唔可以喺 NAS 上跑
# ─────────────────────────────────────────────────────────────
_ON_NAS=0
for _d in $NAS_MARKER_DIRS; do
  [ -d "$_d" ] && _ON_NAS=1
done
[ -e "$SYNOINFO" ] && _ON_NAS=1
unset _d
if [ "$_ON_NAS" = "1" ]; then
  echo "  ⛔ 呢句要喺 Mac 跑 —— 呢部機係 NAS（見到 /volume1、/volume2 或 /etc/synoinfo.conf）。"
  echo
  echo "     唔好喺 NAS 上跑呢個腳本。請返去 Mac 嘅 Terminal，貼："
  echo "         bash ~/fb-oldroot.sh doctor"
  exit 3
fi

# ─────────────────────────────────────────────────────────────
# 子命令驗證（未知 → 明確報錯）
# ─────────────────────────────────────────────────────────────
TASK="${1:-help}"
case "$TASK" in
  doctor|findroot|restore|scan|help) : ;;
  *)
    echo "  ❌ 冇呢個任務：「${TASK}」"
    echo
    echo "  可用任務：doctor / findroot / restore / scan / help"
    echo
    echo "  打「bash ~/fb-oldroot.sh help」睇詳細用法。"
    exit 2
    ;;
esac

if [ "$TASK" = "help" ]; then
  cat <<'EOF'
Firebean 舊 fs-tree 根救援（全程唯讀）

用法（喺 Mac 嘅 Terminal 貼）：

  bash ~/fb-oldroot.sh doctor                  環境自檢（第一句先跑）
  bash ~/fb-oldroot.sh findroot [子卷ID] [塊裝置]
                                               搵舊 fs-tree 根（輸出存檔）
  bash ~/fb-oldroot.sh restore <root bytenr> [輸出目錄] [路徑正則]
                                               先 dry-run，確認後才真正還原
  bash ~/fb-oldroot.sh scan                    一站式：doctor → findroot → 提示

問題資料夾： [56] O'South ／ [91] ACAN 60A ／ [94] EDB Hong Kong Reading for All Day
預設輸出：   /volume2/unused-recovered（另一個卷，永遠唔會寫受害卷 /volume3）
全程唯讀；唔會改 NAS 上任何原始檔；唔會刪 .L0CK3D。
EOF
  exit 0
fi

# ─────────────────────────────────────────────────────────────
# 記錄檔（任務名 + 時間戳；全部輸出同時 tee 落去）
# ─────────────────────────────────────────────────────────────
mkdir -p "$LOGDIR" 2>/dev/null
STAMP=$(date '+%Y%m%d-%H%M%S')
LOG="$LOGDIR/${TASK}-${STAMP}.txt"
ERRF="$LOGDIR/${TASK}-${STAMP}.err"
RAW="$LOGDIR/${TASK}-${STAMP}.raw.txt"
LEAVES="$LOGDIR/${TASK}-${STAMP}.leaves.txt"
: > "$LOG"; : > "$ERRF"
# 全腳本 stdout/stderr 同步寫入記錄檔（tee）；個別 ssh 再逐條追加
exec > >(tee -a "$LOG") 2>&1

banner() {
  echo "════════════════════════════════════════════════════"
  echo "  Firebean 舊 fs-tree 根救援（${1}）"
  echo "  版本：${VERSION}  ／  BUILD ${BUILD}"
  echo "════════════════════════════════════════════════════"
}
print_ctx() {
  echo "  目標      ：${TARGET}"
  echo "  受害卷    ：${VICTIM_VOL}"
  echo "  問題資料夾：${PROBLEM_DIRS}"
  echo "  唯讀保證  ：✅ 只 O_RDONLY 讀取；唔會寫受害卷；唔刪 .L0CK3D"
  echo
}

# ─────────────────────────────────────────────────────────────
# SSH 支援
#   • 互動類（文字）用 ssh -t ＋ sudo sh -c        （fb.sh 風格）
#   • 串流類用 ssh -T ＋ sudo -S -p '' 由 stdin 餵密碼
#     （ssh -t 會做 CR/LF 轉換，會搞爛二進位／大量輸出，所以唔用）
# ─────────────────────────────────────────────────────────────
PW=""
ask_pw() {
  printf "  🔑 NAS sudo 密碼（唔會顯示、唔會記錄）："
  read -r -s PW
  echo
}
verify_pw() {
  printf '%s\n' "$PW" | ssh -T -o ConnectTimeout=15 "$TARGET" "sudo -S -p '' true" >/dev/null 2>&1
}
need_pw() {
  [ -n "$PW" ] && return 0
  ask_pw
  if verify_pw; then
    echo "  ✅ 密碼正確"
  else
    echo "  ❌ 密碼唔啱或連唔上 NAS —— 中止，冇改動過任何嘢。"
    unset PW
    exit 1
  fi
}
# 互動（文字輸出）：ssh -t ＋ sudo sh -c "..."
ri() {
  ssh -t -o ConnectTimeout=20 "$TARGET" "sudo sh -c \"$1\"" 2>&1
}
# 串流（保持 stdout 純淨）：ssh -T ＋ sudo -S，密碼由 stdin 餵
rs() {
  printf '%s\n' "$PW" | ssh -T -o ConnectTimeout=20 "$TARGET" "sudo -S -p '' sh -c \"$1\"" 2>>"$ERRF"
}

# ─────────────────────────────────────────────────────────────
# 偵測
# ─────────────────────────────────────────────────────────────
detect_subvol() {
  rs "btrfs subvolume show ${SHARE} 2>/dev/null | sed -n 's/.*Subvolume ID:[^0-9]*//p' | head -1" 2>/dev/null | tr -d '\r' | head -1 | sed -E 's/.*ID:[^0-9]*//'
}
detect_blockdev() {
  rs "(command -v lvs >/dev/null 2>&1 && lvs --noheadings -o lv_path 2>/dev/null | tr -d ' ' | grep -i volume | head -1) || ls -l /dev/mapper/ 2>/dev/null | grep -i volume | head -1" 2>/dev/null | tr -d '\r' | head -1
}

# ─────────────────────────────────────────────────────────────
# doctor（NAS 端工具／卷／子卷檢測）
# ─────────────────────────────────────────────────────────────
doctor_body() {
  echo "  ── NAS 端檢測（doctor）──"
  ri "echo '=== btrfs 工具檢測 ==='; command -v btrfs || echo '  冇 btrfs'; command -v btrfs-find-root || echo '  冇 btrfs-find-root'; command -v btrfs-debug-tree || echo '  冇 btrfs-debug-tree'; echo; echo '=== btrfs restore 子命令 ==='; btrfs restore 2>&1 | head -2; echo; echo '=== btrfs subvolume list ${SHARE} ==='; btrfs subvolume list ${SHARE} 2>&1; echo; echo '=== mount（volume）==='; mount | grep volume; echo; echo '=== 卷空間 ==='; df -h ${VICTIM_VOL} /volume2 2>&1"
}
doctor_run() {
  banner "環境自檢（doctor）"
  print_ctx
  need_pw
  echo
  doctor_body
}

# ─────────────────────────────────────────────────────────────
# findroot（搵舊 fs-tree 根）
# ─────────────────────────────────────────────────────────────
findroot_body() {
  [ -n "${1:-}" ] && SUBVOL_ID="$1"
  [ -n "${2:-}" ] && BLOCKDEV="$2"
  if [ -z "$SUBVOL_ID" ]; then
    echo "  🔎 自動偵測子卷 ID…"
    SUBVOL_ID=$(detect_subvol)
  fi
  if [ -z "$BLOCKDEV" ]; then
    echo "  🔎 自動偵測塊裝置（底層 LV）…"
    BLOCKDEV=$(detect_blockdev)
  fi
  if [ -z "$SUBVOL_ID" ] || [ -z "$BLOCKDEV" ]; then
    echo "  ❌ 攞唔到子卷 ID 或塊裝置 —— 請先跑 doctor，再手動指定："
    echo "     bash ~/fb-oldroot.sh findroot <子卷ID> /dev/mapper/vgN-volume_N"
    return 1
  fi
  echo "  子卷 ID   ：${SUBVOL_ID}"
  echo "  塊裝置 LV ：${BLOCKDEV}"
  echo
  # 先檢測 btrfs-find-root 存在（DSM 出廠未必內建 → 要明確告知）
  echo "  🔧 檢查 btrfs-find-root 是否存在…"
  if ! rs "command -v btrfs-find-root >/dev/null 2>&1" 2>/dev/null; then
    echo "  ❌ NAS 上【冇 btrfs-find-root】（DSM 出廠未必內建 btrfs-progs 呢個工具）。"
    echo "     → 請先喺 NAS 上以 root 安裝／帶入 btrfs-progs（提供 btrfs-find-root、btrfs-debug-tree），"
    echo "       或者改用 btrfs restore -f 直接指定已知舊根 bytenr。"
    return 1
  fi
  echo "  ✅ 有 btrfs-find-root"
  echo
  echo "  🏃 跑 btrfs-find-root -a -o ${SUBVOL_ID} ${BLOCKDEV}（可能要幾十分鐘，請耐心）…"
  rs "btrfs-find-root -a -o ${SUBVOL_ID} ${BLOCKDEV} 2>&1" | tee "$RAW"
  echo
  # 摘要：候選 root 數量、最高／最低 generation
  sed -nE 's/.*block ([0-9]+)\(gen: ([0-9]+) level: ([0-9]+)\).*/\2 \3 \1/p' "$RAW" | sort -n -u > "$LEAVES"
  NGEN=$(sed -nE 's/.*block [0-9]+\(gen: ([0-9]+) level: [0-9]+\).*/\1/p' "$RAW" | sort -n)
  CNT=$(printf '%s\n' "$NGEN" | grep -c . 2>/dev/null || echo 0)
  MIN=$(printf '%s\n' "$NGEN" | head -1)
  MAX=$(printf '%s\n' "$NGEN" | tail -1)
  L0=$(awk '$2==0' "$LEAVES" 2>/dev/null | wc -l | tr -d ' ')
  echo "  ── 舊根候選摘要 ──"
  echo "  候選舊根總數（去重 generation）：${CNT}"
  if [ "${CNT:-0}" -gt 0 ] 2>/dev/null; then
    echo "  最低 generation：${MIN}"
    echo "  最高 generation：${MAX}"
  fi
  echo "  其中 level 0 葉子：${L0}"
  echo "  原始輸出：${RAW}"
  echo "  舊根清單（gen level bytenr）：${LEAVES}"
  return 0
}
findroot_run() {
  banner "搵舊 fs-tree 根（findroot）"
  print_ctx
  need_pw
  echo
  findroot_body "${1:-}" "${2:-}"
}

# ─────────────────────────────────────────────────────────────
# restore（先 dry-run，確認後才真正還原；輸出永不寫受害卷）
# ─────────────────────────────────────────────────────────────
restore_run() {
  ROOT="${1:-}"
  DEST="${2:-$DEST_DEFAULT}"
  REGEX="${3:-$DEFAULT_REGEX}"
  banner "舊根還原（restore）"
  if [ -z "$ROOT" ]; then
    echo "  ❌ 用法：bash ~/fb-oldroot.sh restore <root bytenr> [輸出目錄] [路徑正則]"
    exit 2
  fi
  # 安全檢查（喺問密碼之前就拒絕）——輸出永不可寫受害卷
  case "$DEST" in
    "${VICTIM_VOL}"|"${VICTIM_VOL}"/*)
      echo "  ❌ 拒絕：輸出目錄唔可以喺受害卷 ${VICTIM_VOL} 底下（你俾咗：${DEST}）。"
      echo "     請改用另一個卷，例如：${DEST_DEFAULT}"
      exit 2
      ;;
    /*) : ;;
    *)
      echo "  ❌ 拒絕：輸出目錄必須係絕對路徑（你俾咗：${DEST}）。"
      exit 2
      ;;
  esac
  print_ctx
  need_pw
  # 塊裝置
  if [ -z "$BLOCKDEV" ]; then
    echo "  🔎 自動偵測塊裝置（底層 LV）…"
    BLOCKDEV=$(detect_blockdev)
  fi
  if [ -z "$BLOCKDEV" ]; then
    echo "  ❌ 攞唔到塊裝置 —— 請先跑 doctor，或設 FB_BLOCKDEV=/dev/mapper/vgN-volume_N"
    return 1
  fi
  # btrfs 存在檢查
  if ! rs "command -v btrfs >/dev/null 2>&1" 2>/dev/null; then
    echo "  ❌ NAS 上冇 btrfs（btrfs-progs）—— 無法用 btrfs restore。"
    return 1
  fi
  echo
  echo "  ── 還原計劃 ──"
  echo "  舊根 bytenr   ：${ROOT}"
  echo "  塊裝置（LV）  ：${BLOCKDEV}"
  echo "  輸出目錄      ：${DEST}（另一個卷；已確認唔係受害卷 ${VICTIM_VOL}）"
  echo "  路徑正則      ：${REGEX}"
  echo
  echo "  ⚠️ 請自行確認【輸出目錄】已插咗足夠空間嘅另一個卷，並且唔喺 ${VICTIM_VOL}。"
  echo
  # 步驟 1：dry-run（-D，唔會寫任何檔）
  echo "  🧪 步驟 1／2：DRY-RUN（加 -D，完全唔會寫檔）…"
  DRY=$(rs "btrfs restore -D -v -i -f ${ROOT} --path-regex '${REGEX}' ${BLOCKDEV} ${DEST} 2>&1")
  printf '%s\n' "$DRY"
  NREST=$(printf '%s\n' "$DRY" | grep -c 'Restoring' 2>/dev/null || echo 0)
  echo
  echo "  📋 DRY-RUN 見到約 ${NREST} 個檔可列出。"
  echo
  # 明確確認才真正還原（預設唔做）
  printf "  ❓ 確認真正還原去 ${DEST}？（要打 yes 先會做；直接 Enter = 唔做）："
  read -r ANS
  case "$ANS" in
    yes|YES|Yes|y|Y) : ;;
    *)
      echo "  ⏹  已取消 —— 只做咗 dry-run，冇寫任何嘢。"
      return 0
      ;;
  esac
  # 再擋一次受害卷（雙重保險）
  case "$DEST" in
    "${VICTIM_VOL}"|"${VICTIM_VOL}"/*)
      echo "  ❌ 拒絕：輸出目錄喺受害卷底下 —— 中止。"
      exit 2
      ;;
  esac
  echo
  # 空間檢查（真正還原前）—— 唔夠位就唔做，避免寫爆另一個卷
  echo "  📏 檢查輸出卷剩餘空間…"
  DF=$(rs "df -h ${DEST} 2>&1 || df -h \$(dirname ${DEST}) 2>&1" | tr -d '\r')
  printf '%s\n' "$DF"
  echo
  echo "  🚚 步驟 2／2：真正還原（寫入 ${DEST}）…"
  rs "mkdir -p ${DEST}; btrfs restore -v -i -m -f ${ROOT} --path-regex '${REGEX}' ${BLOCKDEV} ${DEST} 2>&1" | tee -a "$LOG"
  echo
  echo "  ✅ 還原指令完成。請去 ${DEST} 檢查成果（工具唔會刪／改 NAS 上任何 .L0CK3D）。"
  return 0
}

# ─────────────────────────────────────────────────────────────
# scan（一站式：doctor → findroot → 提示下一步）
# ─────────────────────────────────────────────────────────────
scan_run() {
  banner "一站式（scan）"
  print_ctx
  need_pw
  echo
  doctor_body
  echo
  echo "════════════════════════════════════════════════════"
  echo "  跟住搵舊 fs-tree 根…"
  echo "════════════════════════════════════════════════════"
  echo
  findroot_body "" ""
  RC=$?
  if [ "$RC" -ne 0 ] 2>/dev/null; then
    echo
    echo "  ⚠️ findroot 未成功（見上）。請處理後再跑 scan／findroot。"
    return 1
  fi
  echo
  echo "  👉 下一步（揀一個 generation 略高過攻擊時間嘅根，先 dry-run）："
  if [ -s "$LEAVES" ]; then
    tail -5 "$LEAVES" 2>/dev/null | while read -r _g _l _b; do
      echo "       bash ~/fb-oldroot.sh restore ${_b}"
    done
  else
    echo "       （搵唔到候選舊根 —— 可能 btrfs-find-root 輸出格式唔同，請把原文掟返俾 Hermes）"
  fi
  echo
  echo "  提示：用「勒索信 mtime ＋ btrfs subvolume find-new」對上 CUTOFF generation，"
  echo "        再揀略高過 CUTOFF 嘅根，成功率最高。"
  return 0
}

# ─────────────────────────────────────────────────────────────
# 派工
# ─────────────────────────────────────────────────────────────
case "$TASK" in
  doctor)   doctor_run ;;
  findroot) findroot_run "${2:-}" "${3:-}" ;;
  restore)  restore_run "${2:-}" "${3:-}" "${4:-}" ;;
  scan)     scan_run ;;
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
# 工具說明（誠實交代）（註釋段落）
# ═══════════════════════════════════════════════════════════════
#
# 1) 呢個工具做咩？
#    C3RB3R／libgld 加密器改咗檔案之後，原本嘅檔案內容（舊 extent）可能仍
#    殘留喺 btrfs 卷上；同時 btrfs 會保留攻擊前嘅【舊 fs-tree 根】（root）。
#    本工具用 btrfs-find-root 掃出所有舊根，再用 btrfs restore -f <root>
#    --path-regex 針對性還原三個問題資料夾，慳時間唔使掃全卷。
#    ⚠️ 完全唔靠記憶體金鑰（唔需要嘅前提取不到密文解密），只靠「舊 metadata
#    仍指向未覆寫嘅舊 extent」。
#
# 2) 預期成功率（誠實）：
#    • [91] ACAN 60A 缺 6 個、[94] EDB Hong Kong Reading for All Day 缺 2 個：
#      若呢 8 個檔屬「0x24 全檔加密」，即整個檔案內容已被新密文覆寫，
#      舊 extent 已被回收 → 成功率【極低】，唔應該抱期望。
#    • [56] O'South 冇 manifest【唔等於還原失敗】——可能整夾本身冇產出
#      manifest，或者全部成功但因故冇 manifest。值得試：舊根路線可能
#      直接搵返更多檔。屬「值得一試」而非「保證成功」。
#    • 整體：呢個係最後手段之一，期望值偏低但成本低、風險近乎零。
#
# 3) 需要幾多額外空間？
#    btrfs restore 會將還原結果寫去【另一個卷】（預設 /volume2/unused-recovered）。
#    所需空間 ≥ 目標資料夾壓縮前總大細（三個問題夾加埋通常 < 數十 GB）。
#    運行前會印 df -h，請自行確保目標卷有空間；本工具唔會寫受害卷。
#
# 4) 點解安全？
#    • 所有讀取只 O_RDONLY（btrfs-find-root、btrfs restore 只讀底層 LV）。
#    • btrfs restore 拒絕已掛載設備，所以會用底層 LV（read-only 讀取），
#      輸出寫去另一卷。
#    • 輸出目錄前綴硬性檢查：只要含 /volume3（受害卷）即拒絕並 exit 2。
#    • 唔會刪除、唔會覆寫任何 .L0CK3D 原始檔（將來若出現對應金鑰仍可再解）。
#    • 預設 dry-run（-D）；真正還原前必須打「yes」明確確認。
#    • 唔需要、亦唔會建立 NOPASSWD sudoers；密碼只經 stdin 餵給 sudo -S，
#      唔寫入磁碟、唔顯示。
# ═══════════════════════════════════════════════════════════════
