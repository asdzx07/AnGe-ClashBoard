#!/bin/sh
# 下载官方 Mihomo 二进制。版本唯一来源：core/mihomo.version
# 可用 MIHOMO_VERSION 环境变量覆盖（升级流程用）。
# 用法：scripts/fetch-mihomo.sh [x64|arm64] [输出目录]
set -eu
cd "$(dirname "$0")/.."

if [ -n "${MIHOMO_VERSION:-}" ]; then
  VERSION="$MIHOMO_VERSION"
else
  VERSION="$(tr -d ' \n\r' < core/mihomo.version)"
fi
ARCH="${1:-$(uname -m)}"
OUTDIR="${2:-core/bin}"
case "$ARCH" in
  x86_64|x64|amd64) MIHOMO_ARCH=amd64 ;;
  aarch64|arm64) MIHOMO_ARCH=arm64 ;;
  *) echo "不支持的架构: $ARCH" >&2; exit 1 ;;
esac

ASSET="mihomo-linux-${MIHOMO_ARCH}-${VERSION}.gz"
BASE="https://github.com/MetaCubeX/mihomo/releases/download/${VERSION}"
mkdir -p "$OUTDIR"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT INT TERM

echo "下载 $BASE/$ASSET ..."
curl -fsSL --retry 3 -o "$tmp/$ASSET" "$BASE/$ASSET"

# 官方若提供 sha256sums.txt 则校验，否则警告跳过
if curl -fsSL -o "$tmp/sha256sums.txt" "$BASE/sha256sums.txt" 2>/dev/null; then
  (cd "$tmp" && grep " ${ASSET}\$" sha256sums.txt | sha256sum -c -) || exit 1
else
  echo "警告：未找到 sha256sums.txt，跳过校验" >&2
fi

gzip -dc "$tmp/$ASSET" > "$OUTDIR/mihomo"
chmod +x "$OUTDIR/mihomo"
"$OUTDIR/mihomo" -v
echo "OK: $OUTDIR/mihomo ($VERSION)"
