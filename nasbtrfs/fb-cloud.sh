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
VERSION="fc2-20261031-1210"
BUILD=2

# rclone 可能裝喺 ~/bin（自己下載嘅情況）→ 一定要先加入 PATH
export PATH="$HOME/bin:$HOME/.local/bin:$PATH"

SRC_DEFAULT="/Volumes/ExternalSSD/dicksonimac/recovered"
REMOTE="gdrive:FirebeanRescue2026"
LOGDIR="$HOME/fb-cloud-logs"

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

case "${1:-help}" in

  setup)
    banner "一次性設定"
    echo
    install_rclone || exit 1
    echo
    if rclone listremotes 2>/dev/null | grep -q '^gdrive:'; then
      echo "  ✅ gdrive 已經設定過（跳過建立）"
    else
      echo "  🔧 建立 gdrive 連線…"
      rclone config create gdrive drive scope drive \
        || { echo "  ❌ 建立失敗"; exit 1; }
      echo "  ✅ 已建立"
    fi
    echo
    echo "  ════════════════════════════════════════════════"
    echo "  🌐 下一步會【自動開瀏覽器】："
    echo "     ① 揀帳號：dickson@firebean.net"
    echo "     ② 若見「Google 未驗證應用」→ 按【進階】"
    echo "        → 再按【繼續前往 rclone（不安全）】"
    echo "     ③ 按【允許 / Allow】"
    echo "  ════════════════════════════════════════════════"
    echo
    read -r -p "  準備好就按 Enter 開始…" _
    rclone config reconnect gdrive: || { echo "  ❌ 授權失敗"; exit 1; }
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
      --transfers 8 --checkers 16 --tpslimit 10 \
      --drive-chunk-size 64M --retries 5 --low-level-retries 20 \
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
    echo "  ── 最近記錄 ──"
    tail -5 "$LOGDIR/upload.log" 2>/dev/null | sed 's/^/     /' || echo "     （冇記錄檔）"
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

  *)
    banner "使用說明"
    cat <<'USAGE'
  bash ~/fb-cloud.sh setup     ① 一次性設定（會開瀏覽器按 Allow）
  bash ~/fb-cloud.sh upload    ② 開始上傳（背景跑，可關窗）
  bash ~/fb-cloud.sh status    ③ 睇進度
  bash ~/fb-cloud.sh check     ④ 核對雲端同本地一致
  bash ~/fb-cloud.sh stop      ⑤ 停止（可續傳）

  預設來源：/Volumes/ExternalSSD/dicksonimac/recovered
  預設雲端：gdrive:FirebeanRescue2026
USAGE
    ;;
esac
