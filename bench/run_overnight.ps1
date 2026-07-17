# Launch a PunchBench run overnight.
# Safe to leave running: resumable, capped at MaxGenerations, stop anytime by
# creating <run-dir>\STOP (or Ctrl+C — the log up to the last finished generation stays valid).
#
# Usage (from the repo root, in PowerShell):
#   .\bench\run_overnight.ps1                                   # best-anchored, 15 generations
#   .\bench\run_overnight.ps1 -Anchor latest -RunDir bench\runs\original
#   .\bench\run_overnight.ps1 -MaxGenerations 30

param(
    [int]$MaxGenerations = 15,
    [ValidateSet("best", "latest")]
    [string]$Anchor = "best",
    [string]$RunDir = "bench\runs\anchored"
)

$venvPython = "C:\Users\marip\.venvs\punchlist\Scripts\python.exe"
$repoRoot = Split-Path -Parent $PSScriptRoot

Set-Location $repoRoot
$logDir = Join-Path $RunDir "results"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

& $venvPython bench\run.py --run-dir $RunDir --anchor $Anchor --max-generations $MaxGenerations `
    *>&1 | Tee-Object -FilePath (Join-Path $logDir "overnight.log") -Append

Write-Host "`nDone. See $RunDir\REPORT.md for the improvement curve and the best prompt."
