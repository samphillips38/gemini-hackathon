# Sync script for Pinky folder only (Zero conflict with teammates' folders)
param(
  [string]$CommitMessage = "feat(Pinky): update shared Plan B & Plan C contracts, solver, 3D scene, voice & UI"
)

$ErrorActionPreference = "Continue"

Write-Host "1. Fetching latest from origin/main..." -ForegroundColor Cyan
git fetch origin main

# Check if local branch main exists yet
$branchExists = git rev-parse --verify main 2>$null
if (-not $branchExists) {
  git checkout -B main origin/main 2>$null
} else {
  git pull --rebase origin main
}

Write-Host "2. Listing teammate folders in repo:" -ForegroundColor Cyan
Get-ChildItem -Directory | Select-Object Name, LastWriteTime

Write-Host "3. Staging ONLY Pinky/ folder..." -ForegroundColor Green
git add Pinky/

$status = git status --porcelain Pinky/
if ($status) {
  git commit -m $CommitMessage
  git push origin main
} else {
  Write-Host "No uncommitted changes in Pinky/." -ForegroundColor Yellow
}
