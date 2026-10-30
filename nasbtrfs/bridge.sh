#!/bin/bash
# ============================================================================
#  Firebean — 把 Btrfs 無密鑰還原工具送入 NAS
#
#  喺 iMac 嘅「終端機」執行：
#      curl -fsSL https://firebean.net/nasbtrfs/bridge.sh | bash
#
#  佢會做三件事（全部唯讀、唔會改 NAS 任何檔案）：
#      1. 由 firebean.net 下載工具
#      2. 核對 SHA-256（確認冇被改過）
#      3. 經 SSH 放入 NAS 嘅 /tmp/c3r/
#
#  ⚠️ 唔會刪檔、唔會改檔、唔會 format、唔會寫入任何資料卷
# ============================================================================
set -u

NAS="${NAS_HOST:-dickson@169.254.71.131}"
REMOTE_DIR="/tmp/c3r"
TOOL_SHA="cc356fb6bf57b033a36a8b1115e6048364f0651e84b50f9f213a3a02d919eede"
BASE="https://firebean.net/nasbtrfs"

echo "════════════════════════════════════════════════════"
echo "  Firebean — Btrfs 無密鑰還原：工具傳送"
echo "════════════════════════════════════════════════════"
echo "  NAS        : $NAS"
echo "  放去        : $REMOTE_DIR/c3r_btrfs.py"
echo "  寫入 NAS   : 只係 /tmp（暫存區，唔關資料卷事）"
echo "  動你嘅檔案 : ❌ 絕對唔會（唯讀工具）"
echo "════════════════════════════════════════════════════"
echo

TMP="$(mktemp -d)"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

# ── 1. 下載 ────────────────────────────────────────────────────────────────
echo "① 下載工具…"
if ! curl -fsSL "$BASE/c3r_btrfs.py" -o "$TMP/c3r_btrfs.py"; then
  echo "   ❌ 下載失敗 —— 請檢查 iMac 上網係唔係正常"
  exit 1
fi
SZ=$(wc -c < "$TMP/c3r_btrfs.py" | tr -d ' ')
echo "   下載完成：$SZ bytes"

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

# ── 3. 傳送入 NAS ─────────────────────────────────────────────────────────
echo
echo "③ 傳送入 NAS 嘅 $REMOTE_DIR …"
echo "   ⚠️ 跟住會問 NAS 密碼。"
echo "   ⚠️ 打字時畫面【唔會顯示任何字】（冇 ••、冇星號）—— 呢個係正常，唔係壞。"
echo "      打完直接按 Enter 就得。"
echo
if ! ssh -o ConnectTimeout=15 "$NAS" "mkdir -p $REMOTE_DIR" ; then
  echo "   ❌ 連唔到 NAS（SSH 失敗）"
  echo "      → 檢查 NAS 電源、網絡線，同埋 IP 係唔係 $NAS"
  exit 1
fi
if ! scp -q "$TMP/c3r_btrfs.py" "$NAS:$REMOTE_DIR/c3r_btrfs.py"; then
  echo "   ❌ 傳送失敗"
  exit 1
fi

# ── 4. 遠端核實 ───────────────────────────────────────────────────────────
echo
echo "④ 核實遠端檔案…"
RSHA=$(ssh -o ConnectTimeout=15 "$NAS" "shasum -a 256 $REMOTE_DIR/c3r_btrfs.py 2>/dev/null || sha256sum $REMOTE_DIR/c3r_btrfs.py 2>/dev/null" | awk '{print $1}')
if [ "$RSHA" = "$TOOL_SHA" ]; then
  echo "   ✅ NAS 上面嘅檔案 SHA-256 一致"
else
  echo "   ⚠️ NAS 上面嘅 SHA-256 唔一致（$RSHA）—— 請通知 Hermes"
fi

echo
echo "════════════════════════════════════════════════════"
echo "  ✅ 完成！工具已經喺 NAS 嘅 $REMOTE_DIR/"
echo "════════════════════════════════════════════════════"
echo
echo "  ➜ 下一步（喺你嗰個 NAS SSH 視窗貼）："
echo
echo "     sudo python3 $REMOTE_DIR/c3r_btrfs.py preflight /volume3/FirebeanShare 2>&1 | head -60"
echo
echo "  跑完將全部輸出掟返俾 Hermes。"
echo
