param([string]$MySqlBin = 'C:\xampp\mysql\bin')
$ErrorActionPreference = 'Stop'
$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$dataDir = [IO.Path]::GetFullPath((Join-Path $repoRoot 'tmp\lcup-po-correction-db\data'))
$logFile = Join-Path $repoRoot 'tmp\lcup-po-correction-db\server.log'
if (-not $dataDir.StartsWith($repoRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Workspace data directory required' }
if (-not (Test-Path -LiteralPath (Join-Path $dataDir 'ibdata1'))) { throw 'Initialize a NEW disposable data directory first; see REPORT.md. This script never initializes or overwrites one.' }
if ([Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners().Port -contains 43308) { throw 'Port 43308 is in use; refusing to start or stop another server' }
$baseDir = Split-Path -Parent $MySqlBin
$serverProcess = Start-Process -FilePath (Join-Path $MySqlBin 'mysqld.exe') -ArgumentList @('--no-defaults', ('--basedir="' + $baseDir + '"'), ('--datadir="' + $dataDir + '"'), '--port=43308', '--bind-address=127.0.0.1', '--skip-name-resolve', '--innodb-use-native-aio=0', '--innodb-buffer-pool-size=32M', ('--log-error="' + $logFile + '"')) -WindowStyle Hidden -PassThru
$serverProcess.Id | Set-Content -LiteralPath (Join-Path $repoRoot 'docs\lcup-po-correction\disposable.pid')
Write-Output ('Started workspace disposable server PID ' + $serverProcess.Id + ' on port 43308. Tests independently verify @@datadir before writing.')
