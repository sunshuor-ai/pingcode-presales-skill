# PingCode 售前演示 Skill 安装脚本（Windows PowerShell）
# 用法：在 pingcode-presales 文件夹同级目录下运行 .\install.ps1

$ErrorActionPreference = "Stop"

$skillName = "pingcode-presales"
$targetBase = "$env:USERPROFILE\.claude\skills"
$targetDir = "$targetBase\$skillName"
$sourceDir = $PSScriptRoot  # install.ps1 所在的目录即 skill 根目录

Write-Host "PingCode 售前演示 Skill 安装器" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan

# 检查 Claude Code 目录是否存在
if (-not (Test-Path "$env:USERPROFILE\.claude")) {
    Write-Host "错误：未找到 ~/.claude 目录，请先安装 Claude Code。" -ForegroundColor Red
    Write-Host "下载地址：https://claude.ai/code" -ForegroundColor Yellow
    exit 1
}

# 创建 skills 目录（如不存在）
if (-not (Test-Path $targetBase)) {
    New-Item -ItemType Directory -Force -Path $targetBase | Out-Null
    Write-Host "创建目录：$targetBase" -ForegroundColor Gray
}

# 如果已存在，先备份
if (Test-Path $targetDir) {
    $backup = "$targetDir.bak_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
    Rename-Item -Path $targetDir -NewName $backup
    Write-Host "已备份旧版本到：$backup" -ForegroundColor Yellow
}

# 复制 skill 文件夹
Copy-Item -Path $sourceDir -Destination $targetDir -Recurse
Write-Host "已安装到：$targetDir" -ForegroundColor Green

Write-Host ""
Write-Host "安装完成！请重启 Claude Code，然后输入：" -ForegroundColor Cyan
Write-Host "  来活了，搭模板" -ForegroundColor White
Write-Host "即可开始使用。" -ForegroundColor Cyan
