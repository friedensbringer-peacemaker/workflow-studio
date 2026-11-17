#requires -Version 5.1
[CmdletBinding()]
param([string]$NodeExe, [switch]$CheckOnly)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
if (-not $NodeExe) {
  $localRuntime = Join-Path (Split-Path $root -Parent) '.tools\node-v24.22.1-win-x64\node.exe'
  if (Test-Path -LiteralPath $localRuntime) { $NodeExe = $localRuntime }
  else { $NodeExe = (Get-Command node.exe -ErrorAction Stop).Source }
}
$nodeRoot = Split-Path $NodeExe -Parent
$runtime = Join-Path $root 'node_modules\electron\dist\electron.exe'
if (-not (Test-Path -LiteralPath $runtime)) { throw 'Install the reviewed Electron runtime first; see docs/fork/STUDIO.md.' }
if ($CheckOnly) {
  & $NodeExe --version
  if ($LASTEXITCODE -ne 0) { throw 'Node runtime check failed.' }
  Write-Host "Studio prerequisites found. PowerShell $($PSVersionTable.PSVersion). No app was launched."
  return
}
$previousPath = $env:PATH
$previousStudio = $env:SKILL_RECORDER_OPEN_STUDIO
$previousCodex = $env:SKILL_RECORDER_CODEX_CLI
try {
  $env:PATH = $nodeRoot + ';' + $env:PATH
  $env:SKILL_RECORDER_OPEN_STUDIO = '1'
  $codex = Get-Command codex.exe -ErrorAction SilentlyContinue
  if ($codex) { $env:SKILL_RECORDER_CODEX_CLI = $codex.Source }
  elseif (-not $env:SKILL_RECORDER_CODEX_CLI -and $env:LOCALAPPDATA) {
    # Desktop launches do not necessarily inherit Codex's private PATH entry.
    $codexBins = Join-Path $env:LOCALAPPDATA 'OpenAI\Codex\bin'
    $installedCodex = Get-ChildItem -LiteralPath $codexBins -Directory -ErrorAction SilentlyContinue |
      Sort-Object LastWriteTime -Descending |
      ForEach-Object { Join-Path $_.FullName 'codex.exe' } |
      Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
    if ($installedCodex) { $env:SKILL_RECORDER_CODEX_CLI = $installedCodex }
  }
  Push-Location $root
  try {
    & $NodeExe (Join-Path $nodeRoot 'node_modules\npm\bin\npm-cli.js') run build
    if ($LASTEXITCODE -ne 0) { throw 'Build failed. Studio was not launched.' }
  } finally { Pop-Location }
  $profile = Join-Path $root '.local\studio-profile'
  Start-Process -FilePath $runtime -ArgumentList @(('"{0}"' -f $root),('--user-data-dir="{0}"' -f $profile)) -WorkingDirectory $root -WindowStyle Normal
  Write-Host "Workflow Studio opened. Separate local profile: $profile"
} finally {
  $env:PATH = $previousPath
  $env:SKILL_RECORDER_OPEN_STUDIO = $previousStudio
  $env:SKILL_RECORDER_CODEX_CLI = $previousCodex
}
