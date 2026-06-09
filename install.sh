#!/usr/bin/env bash
# PingCode 售前演示 Skill 安装脚本（Mac / Linux）
# 用法：bash install.sh

set -e

SKILL_NAME="pingcode-presales"
TARGET_BASE="$HOME/.claude/skills"
TARGET_DIR="$TARGET_BASE/$SKILL_NAME"
SOURCE_DIR="$(cd "$(dirname "$0")" && pwd)"  # install.sh 所在目录即 skill 根目录

echo "PingCode 售前演示 Skill 安装器"
echo "================================"

# 检查 Claude Code 目录
if [ ! -d "$HOME/.claude" ]; then
    echo "错误：未找到 ~/.claude 目录，请先安装 Claude Code。"
    echo "下载地址：https://claude.ai/code"
    exit 1
fi

# 创建 skills 目录（如不存在）
mkdir -p "$TARGET_BASE"

# 如果已存在，先备份
if [ -d "$TARGET_DIR" ]; then
    BACKUP="${TARGET_DIR}.bak_$(date +%Y%m%d_%H%M%S)"
    mv "$TARGET_DIR" "$BACKUP"
    echo "已备份旧版本到：$BACKUP"
fi

# 复制 skill 文件夹
cp -r "$SOURCE_DIR" "$TARGET_DIR"
echo "已安装到：$TARGET_DIR"

echo ""
echo "安装完成！请重启 Claude Code，然后输入："
echo "  来活了，搭模板"
echo "即可开始使用。"
