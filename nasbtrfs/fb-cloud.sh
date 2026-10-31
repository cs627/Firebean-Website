#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
#  Firebean 雲端備份 —— 一鍵工具
#  用途：將已經救返嘅資料，上傳去 Google Drive 做第二份（異地備份）
#  用法：bash ~/fb-cloud.sh setup    ← 只需做一次
#        bash ~/fb-cloud.sh upload   ← 開始上傳
#        bash ~/fb-cloud.sh status   ← 睇進度
#        bash ~/fb-cloud.sh check    ← 核對
#        bash ~/fb-cloud.sh stop     ← 停
# ═══════════════════════════════════════════════════════════════
set -uo pipefail
VERSION="fc6-20261031-1420"
BUILD=6

# rclone 可能裝喺 ~/bin（自己下載嘅情況）→ 一定要先加入 PATH
export PATH="$HOME/bin:$HOME/.local/bin:$PATH"

SRC_DEFAULT="/Volumes/ExternalSSD/dicksonimac/recovered"
REMOTE="gdrive:FirebeanRescue2026"
LOGDIR="$HOME/fb-cloud-logs"

# rclone 官方共用 OAuth client（公開資料，來自 rclone 原始碼 backend/drive/drive.go）
# ★ 明確指定就唔會再跳出「Continue using the shared client_id anyway? y/n」提問
# ★ 亦避免用戶誤將「y」當成 client_id 輸入（會導致 Error 401: invalid_client）
RCLONE_SHARED_ID="202264815644.apps.googleusercontent.com"
RCLONE_SHARED_SECRET="X4Z3ca8xfWDb1Voo-F9a7ZxJ"

# ─────────────────────────────────────────────────────────────
# 遮蔽敏感資料（rclone 會將 token 明文印出，一定要過濾）
# ─────────────────────────────────────────────────────────────
redact() {
  sed -E 's/("(access_token|refresh_token|client_secret|token)"[[:space:]]*:[[:space:]]*")[^"]*/\1[已遮蔽]/g' \
  | sed -E 's/"access_token":"[^"]*"/"access_token":"[已遮蔽]"/g'
}

banner() {
  echo "════════════════════════════════════════════════════"
  echo "  Firebean 雲端備份（$1）"
  echo "  版本：$VERSION"
  echo "════════════════════════════════════════════════════"
}

# ─────────────────────────────────────────────────────────────
# 安裝 rclone（★ 唔需要 Homebrew、唔需要 sudo）
#   ① 已經有 → 直接用
#   ② 有 Homebrew → 用 brew（最快）
#   ③ 冇 Homebrew → 直接下載官方二進位檔放 ~/bin
# ─────────────────────────────────────────────────────────────
install_rclone() {
  if command -v rclone >/dev/null 2>&1; then
    echo "  ✅ rclone 已安裝：$(rclone version 2>/dev/null | head -1)"
    return 0
  fi
  if command -v brew >/dev/null 2>&1; then
    echo "  📦 用 Homebrew 安裝 rclone…"
    if brew install rclone; then
      export PATH="$(brew --prefix 2>/dev/null)/bin:$PATH"
      return 0
    fi
    echo "  ⚠️ Homebrew 安裝失敗 → 改用官方二進位檔"
  fi
  local arch url tmpd
  case "$(uname -m)" in
    arm64) arch="arm64" ;;
    x86_64) arch="amd64" ;;
    *) arch="amd64" ;;
  esac
  url="https://downloads.rclone.org/rclone-current-osx-${arch}.zip"
  echo "  📦 下載官方 rclone（${arch}）—— 唔需要 sudo…"
  tmpd=$(mktemp -d) || { echo "  ❌ 開唔到暫存目錄"; return 1; }
  mkdir -p "$HOME/bin"
  if curl -fsSL -o "$tmpd/rclone.zip" "$url" \
     && unzip -o -j "$tmpd/rclone.zip" '*/rclone' -d "$HOME/bin" >/dev/null \
     && chmod +x "$HOME/bin/rclone"; then
    rm -rf "$tmpd"
    export PATH="$HOME/bin:$PATH"
    echo "  ✅ rclone 已安裝到 ~/bin/rclone"
    return 0
  fi
  rm -rf "$tmpd"
  echo "  ❌ 自動安裝失敗。請手動下載：https://rclone.org/downloads/"
  return 1
}

need_rclone() {
  if ! command -v rclone >/dev/null 2>&1; then
    echo "  ❌ 未安裝 rclone"
    echo "     請先執行：bash ~/fb-cloud.sh setup"
    exit 1
  fi
}

# ─────────────────────────────────────────────────────────────
# 建立／重建 gdrive 連線
#   ★ 明確傳入 client_id + client_secret + config_is_local true
#     → rclone 唔會再問任何 y/n 問題（實測零提問）
#     → 直接開瀏覽器做授權
# ─────────────────────────────────────────────────────────────
build_gdrive() {
  if rclone listremotes 2>/dev/null | grep -q '^gdrive:'; then
    echo "  🗑️  刪除舊嘅 gdrive 設定（清理壞咗嘅 client_id）…"
    rclone config delete gdrive 2>&1 | redact || true
  fi
  echo
  echo "  ════════════════════════════════════════════════"
  echo "  🌐 即將【自動開瀏覽器】："
  echo "     ① 揀帳號：dickson@firebean.net"
  echo "     ② 若見「Google 未驗證應用」→ 按【進階】"
  echo "        → 再按【繼續前往 rclone（不安全）】"
  echo "     ③ 按【允許 / Allow】"
  echo "  ✅ 今次唔會再問你任何 y/n 問題"
  echo "  ════════════════════════════════════════════════"
  echo
  read -r -p "  準備好就按 Enter 開始…" _
  echo "  🔧 建立 gdrive 連線（等瀏覽器按完【允許】）…"
  rclone config create gdrive drive scope drive \
    client_id "$RCLONE_SHARED_ID" \
    client_secret "$RCLONE_SHARED_SECRET" \
    config_is_local true 2>&1 | redact
  echo "  ✅ 已建立"
}

case "${1:-help}" in

  setup)
    banner "一次性設定"
    echo
    install_rclone || exit 1
    echo
    # ★ 如果連線已經通，就唔好再動佢（避免重複授權、重複外洩 token）
    if rclone lsd gdrive: >/dev/null 2>&1; then
      echo "  ✅✅ 連線已經成功 —— 唔需要再授權"
      echo
      echo "  👉 下一步：bash ~/fb-cloud.sh upload"
      exit 0
    fi
    build_gdrive
    echo
    echo "  🔎 測試連線…"
    if rclone lsd gdrive: >/dev/null 2>&1; then
      echo "  ✅✅ 連線成功！你嘅 Drive 已經可以用"
      echo
      echo "  👉 下一步：bash ~/fb-cloud.sh upload"
    else
      echo "  ❌ 連線失敗 —— 請將以上全部輸出掟返俾 Hermes"
      exit 1
    fi
    ;;

  fix)
    banner "修復 gdrive 連線"
    need_rclone
    echo "  重設 gdrive 連線（刪除現有設定再重建，用嚟清理壞咗嘅 client_id）"
    build_gdrive
    echo
    echo "  🔎 測試連線…"
    if rclone lsd gdrive: >/dev/null 2>&1; then
      echo "  ✅✅ 修復成功！"
      echo
      echo "  👉 下一步：bash ~/fb-cloud.sh upload"
    else
      echo "  ❌ 仍然失敗 —— 掟返俾 Hermes"
      exit 1
    fi
    ;;

  upload)
    banner "開始上傳"
    need_rclone
    SRC="${2:-$SRC_DEFAULT}"
    if [ ! -d "$SRC" ]; then
      echo "  ❌ 搵唔到資料夾：$SRC"
      echo "     （如果放喺其他地方：bash ~/fb-cloud.sh upload /你嘅路徑）"
      exit 1
    fi
    if ! rclone lsd gdrive: >/dev/null 2>&1; then
      echo "  ❌ gdrive 未設定好。請先執行：bash ~/fb-cloud.sh setup"
      exit 1
    fi
    mkdir -p "$LOGDIR" || exit 1
    if pgrep -f 'rclone copy' >/dev/null 2>&1; then
      echo "  ⚠️ 已經有上傳喺度跑緊"
      echo "     睇進度：bash ~/fb-cloud.sh status"
      exit 0
    fi
    echo
    echo "  來源     : $SRC"
    echo "  目的地   : $REMOTE"
    echo "  記錄檔   : $LOGDIR/upload.log"
    echo
    echo "  📏 來源大細："
    du -sh "$SRC" 2>/dev/null | awk '{print "     "$1}'
    echo
    echo "  ☁️  開始上傳（背景執行 —— 可以關 Terminal 窗）"
    echo "  ⚠️  但請唔好熄機、唔好拔線"
    echo "  ⚠️  想停止：bash ~/fb-cloud.sh stop（已上傳嘅唔會消失，可續傳）"
    echo
    nohup caffeinate -i -s rclone copy "$SRC" "$REMOTE" \
      --transfers 16 --checkers 32 --tpslimit 50 --tpslimit-burst 100 \
      --drive-chunk-size 64M \
      --timeout 90s --contimeout 20s \
      --retries 5 --low-level-retries 5 \
      --stats 30s --stats-one-line --log-level INFO \
      --log-file "$LOGDIR/upload.log" \
      >/dev/null 2>&1 &
    sleep 12
    if pgrep -f 'rclone copy' >/dev/null 2>&1; then
      echo "  ✅ 上傳已經開始（背景跑緊）"
      echo
      echo "  📊 而家嘅進度："
      tail -3 "$LOGDIR/upload.log" 2>/dev/null | sed 's/^/     /'
      echo
      echo "  👉 隨時打：bash ~/fb-cloud.sh status"
    else
      echo "  ⚠️ 啟動失敗 —— 睇記錄："
      tail -20 "$LOGDIR/upload.log" 2>/dev/null | sed 's/^/     /'
      exit 1
    fi
    ;;

  status)
    banner "上傳進度"
    need_rclone
    if pgrep -f 'rclone copy' >/dev/null 2>&1; then
      echo "  🟢 狀態：上傳中"
    else
      echo "  ⚪ 狀態：冇跑緊（已完成 或 已停止）"
    fi
    echo
    echo "  ── 最新統計 ──"
    if [ -f "$LOGDIR/upload.log" ]; then
      grep -E 'xfr#|[0-9]+%' "$LOGDIR/upload.log" 2>/dev/null | tail -1 | sed 's/^/     /'
    else
      echo "     （冇記錄檔）"
    fi
    echo
    echo "  ── ⚠️ 錯誤／警告（最近 8 條，若空白＝冇問題）──"
    if [ -f "$LOGDIR/upload.log" ]; then
      ERR=$(grep -aE '(ERROR|NOTICE|cannot|ailed|Forbidden|403|429|quota|malware|abuse|denied)' "$LOGDIR/upload.log" 2>/dev/null | grep -avE '[0-9]+%' | tail -8)
      if [ -n "$ERR" ]; then printf '%s\n' "$ERR" | sed 's/^/     /'; else echo "     ✅ 冇錯誤"; fi
    else
      echo "     （冇記錄檔）"
    fi
    echo
    echo "  ── 速度診斷 ──"
    if [ -f "$LOGDIR/upload.log" ]; then
      LAST2=$(grep -aE '[0-9]+%' "$LOGDIR/upload.log" 2>/dev/null | tail -2)
      T1=$(printf '%s\n' "$LAST2" | head -1 | grep -oE '[0-9]{2}:[0-9]{2}:[0-9]{2}' | head -1)
      B1=$(printf '%s\n' "$LAST2" | head -1 | grep -oE '[0-9.]+ [KMGT]iB' | head -1)
      T2=$(printf '%s\n' "$LAST2" | tail -1 | grep -oE '[0-9]{2}:[0-9]{2}:[0-9]{2}' | head -1)
      B2=$(printf '%s\n' "$LAST2" | tail -1 | grep -oE '[0-9.]+ [KMGT]iB' | head -1)
      echo "     最早的樣本：$T1  $B1"
      echo "     最新的樣本：$T2  $B2"
      if [ "$B1" = "$B2" ] && [ -n "$B1" ]; then
        echo "     🔴 兩個樣本完全相同 → 上傳已經卡住，請執行 bash ~/fb-cloud.sh stop 再跑 upload"
      fi
    else
      echo "     （冇記錄檔）"
    fi
    echo
    echo "  ── 雲端已有 ──"
    rclone size "$REMOTE" 2>/dev/null | sed 's/^/     /' || echo "     （未開始）"
    echo
    echo "  ── 本地來源 ──"
    SRC="${2:-$SRC_DEFAULT}"
    du -sh "$SRC" 2>/dev/null | awk '{print "     "$1}' || true
    ;;

  check)
    banner "核對（雲端 vs 本地）"
    need_rclone
    SRC="${2:-$SRC_DEFAULT}"
    echo "  只比對大細（快）—— 唔會重新上傳"
    echo
    rclone check "$SRC" "$REMOTE" --size-only 2>&1 | tail -20 | sed 's/^/     /'
    echo
    echo "  ✅ 若見到「0 differences found」= 雲端同本地完全一致"
    ;;

  stop)
    banner "停止上傳"
    if pkill -f 'rclone copy' 2>/dev/null; then
      echo "  ✅ 已停止"
      echo "  ✅ 已上傳嘅檔唔會消失；下次跑 upload 會自動續傳"
    else
      echo "  ⚪ 冇上傳喺度跑"
    fi
    ;;

  restart)
    banner "重新開始上傳"
    if pkill -f 'rclone copy' 2>/dev/null; then
      echo "  ✅ 已停掉卡住嘅上傳（已上傳嘅檔唔會消失）"
    else
      echo "  ⚪ 冇舊上傳喺度跑"
    fi
    sleep 2
    echo "  🔄 用新設定重新開始…"
    echo
    exec bash "$0" upload
    ;;

  *)
    banner "使用說明"
    cat <<'USAGE'
  bash ~/fb-cloud.sh setup     ① 一次性設定（會開瀏覽器按 Allow）
  bash ~/fb-cloud.sh fix       ①b 連線壞咗時用（重設再授權）
  bash ~/fb-cloud.sh upload    ② 開始上傳（背景跑，可關窗）
  bash ~/fb-cloud.sh restart   ②b 卡住時用（停掉再用新設定重開）
  bash ~/fb-cloud.sh status    ③ 睇進度（會顯示錯誤同卡住警報）
  bash ~/fb-cloud.sh check     ④ 核對雲端同本地一致
  bash ~/fb-cloud.sh stop      ⑤ 停止（可續傳）

  預設來源：/Volumes/ExternalSSD/dicksonimac/recovered
  預設雲端：gdrive:FirebeanRescue2026
USAGE
    ;;
esac
