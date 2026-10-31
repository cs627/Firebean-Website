#!/bin/bash
# ============================================================================
#  Firebean — 把 Btrfs 無密鑰還原工具送入 NAS
#
#  ⚠️ 喺【iMac 嘅 Terminal】執行
#     iMac 提示符 = dicksonimac@Dicksons-iMac ~ %
#     唔好喺 NAS 執行（NAS 提示符 = root@DiskStation:~#）—— NAS 冇上網，一定失敗
#
#      curl -fsSL https://firebean.net/nasbtrfs/bridge.sh | bash
#
#  佢會做四件事（全部唯讀、唔會改 NAS 任何檔案）：
#      1. 由 firebean.net 下載工具
#      2. 核對 SHA-256（確認冇被改過）
#      3. 自動偵測你嘅 NAS SSH 帳號 → 傳入 NAS 嘅 /tmp/c3r/
#      4. 遠端核實
# ============================================================================
set -u

NAS_IP="${NAS_IP:-169.254.71.131}"
REMOTE_DIR="/tmp/c3r"
TOOL_SHA="cc356fb6bf57b033a36a8b1115e6048364f0651e84b50f9f213a3a02d919eede"
BASE="https://firebean.net/nasbtrfs"

# ── 防呆：如果係喺 NAS 上面跑，即刻講清楚 ──────────────────────────────────
if [ -d /volume1 ] || [ -d /volume2 ] || [ -f /etc/synoinfo.conf ]; then
  echo "════════════════════════════════════════════════════"
  echo "  ❌ 呢句唔可以喺 NAS 度跑"
  echo "════════════════════════════════════════════════════"
  echo "  NAS 冇上網，所以永遠都會出："
  echo "      curl: (6) Could not resolve host: firebean.net"
  echo
  echo "  ➜ 去 iMac 開「終端機」（⌘+空白鍵 → 打 terminal → Enter）"
  echo "    iMac 嘅提示符係：  dicksonimac@Dicksons-iMac ~ %"
  echo "    喺嗰度貼呢句："
  echo "      curl -fsSL $BASE/bridge.sh | bash"
  echo
  exit 1
fi


echo "════════════════════════════════════════════════════"
echo "  Firebean — Btrfs 無密鑰還原：工具傳送"
echo "════════════════════════════════════════════════════"
echo "  由              : $(whoami)@$(hostname)"
echo "  目標 NAS        : $NAS_IP"
echo "  放去 NAS        : $REMOTE_DIR/c3r_btrfs.py"
echo "  寫入 NAS        : 只係 /tmp（暫存區，唔關資料卷事）"
echo "  動你嘅檔案      : ❌ 絕對唔會（唯讀工具）"
echo "════════════════════════════════════════════════════"
echo

TMP="$(mktemp -d)"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

# ── 1. 下載 ────────────────────────────────────────────────────────────────
echo "① 下載工具…"
if ! curl -fsSL "$BASE/c3r_btrfs.py" -o "$TMP/c3r_btrfs.py"; then
  echo "   ❌ 下載失敗 —— 請檢查 iMac 上網（開 Safari 睇下上唔上到網）"
  exit 1
fi
echo "   下載完成：$(wc -c < "$TMP/c3r_btrfs.py" | tr -d ' ') bytes"

# ── 2. 核對 SHA-256 ───────────────────────────────────────────────────────
echo
echo "② 核對完整性…"
GOT=$(shasum -a 256 "$TMP/c3r_btrfs.py" | awk '{print $1}')
if [ "$GOT" != "$TOOL_SHA" ]; then
  echo "   ❌ SHA-256 唔吻合，唔會傳送去 NAS"
  echo "      預期 : $TOOL_SHA"
  echo "      實際 : $GOT"
  exit 1
fi
echo "   ✅ SHA-256 吻合：$GOT"

# ── 3. 自動偵測 NAS SSH 目標 ──────────────────────────────────────────────
detect_target() {
  # a) 環境變數最優先
  if [ -n "${NAS_USER:-}" ]; then echo "${NAS_USER}@${NAS_IP}"; return; fi
  # b) 由 shell 歷史搵佢實際用過嘅 ssh 命令
  for h in "$HOME/.zsh_history" "$HOME/.bash_history" "$HOME/.sh_history"; do
    [ -f "$h" ] || continue
    line=$(strings "$h" 2>/dev/null | grep -oE "ssh +[^|;&]*${NAS_IP}[^ ]*" | tail -1)
    if [ -n "$line" ]; then
      tgt=$(echo "$line" | tr ' ' '\n' | grep "${NAS_IP}" | tail -1)
      case "$tgt" in
        *"@"*) echo "$tgt"; return ;;
      esac
    fi
  done
  # c) 由 ~/.ssh/config 搵 HostName 對應
  if [ -f "$HOME/.ssh/config" ]; then
    tgt=$(awk -v ip="$NAS_IP" '
      /^[Hh]ost[ \t]/ {h=$2}
      /^[ \t]*[Hh]ost[Nn]ame[ \t]/ {if ($2==ip) print h}
    ' "$HOME/.ssh/config" | tail -1)
    [ -n "$tgt" ] && { echo "$tgt"; return; }
  fi
  echo ""
}

TARGET="$(detect_target)"
echo
if [ -n "$TARGET" ]; then
  echo "③ 自動偵測到你用嘅 NAS 帳號：$TARGET"
else
  TARGET="dickson@${NAS_IP}"
  echo "③ 用預設帳號：$TARGET"
fi

# ── 3+4. 一次連線搞掂：建目錄 + 寫入工具 + 即場核對 SHA-256 ───────────────
#  ⚠️ 唔用 scp：macOS 新版 scp 走 SFTP 子系統，而 DSM 通常冇開 → 會 "Connection closed"。
#  用 `ssh host "cat > 檔案" < 本地檔` 最原始、最穩，而且只需打一次密碼。
REMOTE_CMD="mkdir -p $REMOTE_DIR && cat > $REMOTE_DIR/c3r_btrfs.py && { sha256sum $REMOTE_DIR/c3r_btrfs.py 2>/dev/null || shasum -a 256 $REMOTE_DIR/c3r_btrfs.py; }"

OK=0
TRIED=""
echo
echo "   ⚠️ 會問 NAS 密碼。打字時畫面【唔會顯示任何字】（冇 ••、冇星號）"
echo "      呢個係正常，打完直接按 Enter。（只需要打一次）"
echo
for t in "$TARGET" "dickson@${NAS_IP}" "admin@${NAS_IP}" "root@${NAS_IP}"; do
  [ -z "$t" ] && continue
  case " $TRIED " in *" $t "*) continue ;; esac
  TRIED="$TRIED $t"
  echo "   → 試 $t …"
  if ssh -o ConnectTimeout=15 -o StrictHostKeyChecking=accept-new "$t" "$REMOTE_CMD" \
        < "$TMP/c3r_btrfs.py" > "$TMP/remote_sha.txt" 2>"$TMP/remote_err.txt"; then
    OK=1; TARGET="$t"; break
  fi
  echo "     （唔通，試下一個）"
done

if [ "$OK" != "1" ]; then
  echo
  echo "   ❌ 全部帳號都傳唔到入 NAS（試過：${TRIED}）"
  [ -s "$TMP/remote_err.txt" ] && { echo "      最後錯誤："; sed 's/^/        /' "$TMP/remote_err.txt" | head -5; }
  echo "      → ① 先喺 NAS 視窗打： ifconfig | grep 169.254   睇實際 IP"
  echo "      → ② 再喺 iMac 打："
  echo "           NAS_IP=實際IP NAS_USER=你嘅帳號 bash ~/fb-bridge.sh"
  echo "      → 或者完全唔用 SSH，改用 USB 隨身碟（見網頁步驟 ④）"
  exit 1
fi

echo
echo "   ✅ 已傳送入 $TARGET:$REMOTE_DIR/"
RSHA=$(awk '{print $1}' "$TMP/remote_sha.txt" | head -1)
if [ "$RSHA" = "$TOOL_SHA" ]; then
  echo "   ✅ NAS 上面嘅檔案 SHA-256 一致（逐 byte 核對通過）"
else
  echo "   ⚠️ NAS 上面嘅 SHA-256 唔一致（${RSHA}）—— 請通知 Hermes"
fi

echo
echo "════════════════════════════════════════════════════"
echo "  ✅ 完成！工具已經喺 NAS 嘅 $REMOTE_DIR/"
echo "════════════════════════════════════════════════════"
echo
echo "  ➜ 下一步：返去你嗰個 NAS 視窗（提示符 root@DiskStation:~# 嗰個）貼："
echo
echo "     sudo python3 $REMOTE_DIR/c3r_btrfs.py preflight /volume3/FirebeanShare 2>&1 | head -80"
echo
echo "  跑完將全部輸出掟返俾 Hermes。（可以喺 Discord 直接複製貼上，或者打字文件都可以）"
echo
