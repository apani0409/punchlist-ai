# Launch PunchBench for an overnight run.
# Safe to leave running: resumable, capped at MAX generations, stop anytime by
# creating bench/STOP (or Ctrl+C — the log up to the last finished generation stays valid).
#
# Usage (from the repo root, in PowerShell):
#   .\bench\run_overnight.ps1
#   .\bench\run_overnight.ps1 -MaxGenerations 30

param(
    [int]$MaxGenerations = 15
)

$venvPython = "C:\Users\marip\.venvs\punchlist\Scripts\python.exe"
$repoRoot = Split-Path -Parent $PSScriptRoot

Set-Location $repoRoot
& $venvPython bench\run.py --max-generations $MaxGenerations *>&1 | Tee-Object -FilePath "bench\results\overnight.log" -Append

Write-Host "`nDone. See bench\REPORT.md for the improvement curve and the best prompt."
