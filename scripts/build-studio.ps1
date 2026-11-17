#requires -Version 7.0
[CmdletBinding()]
param(
  [string]$SourceArchive,
  [ValidatePattern('^[a-fA-F0-9]{40}$')][string]$Commit,
  [ValidatePattern('^[a-fA-F0-9]{64}$')][string]$ArchiveSha256,
  [Parameter(Mandatory)][string]$NodeExe,
  [string]$ReviewedCache,
  [Parameter(Mandatory)][switch]$ReviewedSource
)
Set-StrictMode -Version Latest
$ErrorActionPreference='Stop'
if (-not $ReviewedSource -or (-not $SourceArchive -and -not $Commit) -or ($SourceArchive -and $Commit)) { throw 'Select one reviewed local source ZIP or exact fork commit.' }
if (-not $IsWindows -or [Runtime.InteropServices.RuntimeInformation]::OSArchitecture -ne 'X64') { throw 'Windows x64 required.' }
$repository = Split-Path $PSScriptRoot -Parent
$workspace = Split-Path $repository -Parent
$run = 'studio-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '-' + [guid]::NewGuid().ToString('N').Substring(0,8)
$work = Join-Path $workspace ".build\$run"
$output = Join-Path $workspace "output\$run"
New-Item -ItemType Directory -Path $work,$output | Out-Null
Start-Transcript -Path (Join-Path $output 'build.log') | Out-Null
$oldPath=$env:PATH
function Hash([string]$File) { (Get-FileHash -LiteralPath $File -Algorithm SHA256).Hash.ToLowerInvariant() }
try {
  $NodeExe=(Resolve-Path -LiteralPath $NodeExe).Path
  $nodeRoot=Split-Path $NodeExe -Parent
  $npmCli=Join-Path $nodeRoot 'node_modules\npm\bin\npm-cli.js'
  $env:PATH=$nodeRoot+';'+$env:PATH
  $info=& $NodeExe -p 'JSON.stringify({version:process.version,arch:process.arch})' | ConvertFrom-Json
  if ($info.version -notmatch '^v24\.' -or [version]$info.version.TrimStart('v') -lt [version]'24.19.0' -or $info.arch -ne 'x64') { throw 'Reviewed Node 24.19+ x64 required.' }
  $archive=Join-Path $work 'studio-source.zip'
  if ($SourceArchive) { Copy-Item -LiteralPath (Resolve-Path -LiteralPath $SourceArchive).Path -Destination $archive }
  else { Invoke-WebRequest -Uri "https://codeload.github.com/friedensbringer-peacemaker/workflow-studio/zip/$Commit" -OutFile $archive }
  $sourceHash=Hash $archive
  if ($ArchiveSha256 -and $sourceHash -ne $ArchiveSha256.ToLowerInvariant()) { throw 'Source hash mismatch.' }
  $source=Join-Path $work 'source'
  $prefix=[IO.Path]::GetFullPath($source).TrimEnd('\')+'\'
  $zip=[IO.Compression.ZipFile]::OpenRead($archive)
  try { foreach($entry in $zip.Entries) {
    $target=[IO.Path]::GetFullPath((Join-Path $source $entry.FullName))
    if (-not $target.StartsWith($prefix,[StringComparison]::OrdinalIgnoreCase) -or (($entry.ExternalAttributes -shr 16 -band 0xF000) -eq 0xA000)) { throw 'Unsafe source archive.' }
  }} finally { $zip.Dispose() }
  Expand-Archive -LiteralPath $archive -DestinationPath $source
  if (-not (Test-Path -LiteralPath (Join-Path $source 'package.json'))) {
    $roots=@(Get-ChildItem -LiteralPath $source -Directory | Where-Object {Test-Path -LiteralPath (Join-Path $_.FullName 'package.json')})
    if ($roots.Count -ne 1) { throw 'Expected one source root.' };$source=$roots[0].FullName
  }
  foreach($required in @('package-lock.json','INSTALL.md','RELEASING.md','scripts\compliance.mjs','scripts\verify-packaged-compliance.mjs','electron\studio\service.ts')) { if (-not (Test-Path -LiteralPath (Join-Path $source $required))) { throw "Missing source: $required" } }
  $lockHash=Hash (Join-Path $source 'package-lock.json')
  if ($ReviewedCache) { Copy-Item -LiteralPath (Resolve-Path -LiteralPath $ReviewedCache).Path -Destination (Join-Path $source '.compliance-cache') -Recurse }
  function Npm([string[]]$NpmArgs) { & $NodeExe $npmCli @NpmArgs; if ($LASTEXITCODE -ne 0) { throw "npm $($NpmArgs -join ' ') failed: $LASTEXITCODE" } }
  Push-Location $source
  try {
    Npm @('run','check:lockfile')
    Npm @('ci','--ignore-scripts=false','--dangerously-allow-all-scripts=false','--strict-allow-scripts')
    Npm @('run','electron:install-reviewed')
    Npm @('test')
    Npm @('run','test:studio')
    Npm @('run','build')
    # Source already includes the reviewed ASAR resolver fix; never repatch blindly.
    Npm @('run','dist:portable:win','--','--config.compression=store','--config.productName=Workflow Studio','--config.appId=app.workflowstudio.desktop','--config.win.icon=electron/assets/icons/studio-active.png')
  } finally { Pop-Location }
  if ((Hash (Join-Path $source 'package-lock.json')) -ne $lockHash) { throw 'Lockfile changed.' }
  $executables=@(Get-ChildItem -LiteralPath (Join-Path $source 'release') -File -Filter '*.exe')
  if ($executables.Count -ne 1) { throw 'Expected one portable EXE.' }
  $staging=Join-Path $work 'distribution';New-Item -ItemType Directory -Path $staging | Out-Null
  Copy-Item -LiteralPath $executables[0].FullName -Destination (Join-Path $staging 'WorkflowStudio.exe')
  [IO.Compression.ZipFile]::CreateFromDirectory((Join-Path $source '.compliance'),(Join-Path $staging 'compliance.zip'),[IO.Compression.CompressionLevel]::Optimal,$false)
  Copy-Item -LiteralPath $archive -Destination (Join-Path $staging 'studio-source.zip')
  Copy-Item -LiteralPath (Join-Path $source 'LICENSE'),(Join-Path $source 'THIRD-PARTY-NOTICES.md') -Destination $staging
  'Unsigned Windows x64 development build. Start WorkflowStudio.exe. Source and complete matching compliance materials are included. Recordings and credentials are excluded. Models and provider CLIs are configured separately. Startup does not validate recording, analysis or generated skills.' | Set-Content -LiteralPath (Join-Path $staging 'README.txt') -Encoding utf8
  $files=@(Get-ChildItem -LiteralPath $staging -File | ForEach-Object { [ordered]@{name=$_.Name;sha256=(Hash $_.FullName);bytes=$_.Length} })
  [ordered]@{project='https://github.com/friedensbringer-peacemaker/workflow-studio';commit=$Commit;sourceSha256=$sourceHash;lockSha256=$lockHash;node=$info.version;signed=$false;builtAtUtc=[DateTime]::UtcNow.ToString('o');buildSource=$source;files=$files} | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath (Join-Path $staging 'build-manifest.json') -Encoding utf8
  $destination=Join-Path $output 'Workflow-Studio-Windows-x64.zip'
  [IO.Compression.ZipFile]::CreateFromDirectory($staging,$destination,[IO.Compression.CompressionLevel]::Optimal,$false)
  "$(Hash $destination)  $([IO.Path]::GetFileName($destination))" | Set-Content -LiteralPath (Join-Path $output 'SHA256SUMS.txt') -Encoding ascii
  Write-Host "PACKAGE: $destination"
  Write-Host "EXTRACTED APPLICATION FOR SEPARATE SMOKE TEST: $(Join-Path $source 'release\win-unpacked')"
} finally { $env:PATH=$oldPath;Stop-Transcript | Out-Null }
