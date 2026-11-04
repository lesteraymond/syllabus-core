param([string]$MySqlBin='C:\xampp\mysql\bin')
$ErrorActionPreference='Stop'
$repoRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$taskRoot=[IO.Path]::GetFullPath((Join-Path $repoRoot ('tmp\lcup-comprehensive-verification-db-'+[DateTime]::UtcNow.Ticks)))
if(-not $taskRoot.StartsWith($repoRoot+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'Workspace-owned target required'}
if(Test-Path -LiteralPath $taskRoot){throw 'Fresh target required; never initialize existing data'}
if([Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners().Port -contains 43309){throw 'Port 43309 occupied; refusing another server'}
$dataDir=Join-Path $taskRoot 'data'
New-Item -ItemType Directory -Path $dataDir | Out-Null
$initialize=Start-Process -FilePath (Join-Path $MySqlBin 'mysql_install_db.exe') -ArgumentList @('--datadir="'+$dataDir+'"','--port=43309','--password=lcup-comprehensive-test-only') -WindowStyle Hidden -Wait -PassThru -RedirectStandardOutput (Join-Path $taskRoot 'initialize.log') -RedirectStandardError (Join-Path $taskRoot 'initialize-error.log')
if($initialize.ExitCode -ne 0){throw ('Disposable initialization failed: '+$initialize.ExitCode)}
$baseDir=Split-Path -Parent $MySqlBin
$serverProcess=Start-Process -FilePath (Join-Path $MySqlBin 'mysqld.exe') -ArgumentList @('--no-defaults',('--basedir="'+$baseDir+'"'),('--datadir="'+$dataDir+'"'),'--port=43309','--bind-address=127.0.0.1','--skip-name-resolve','--innodb-use-native-aio=0','--innodb-buffer-pool-size=32M',('--log-error="'+(Join-Path $taskRoot 'server.log')+'"')) -WindowStyle Hidden -PassThru
$config=@{host='127.0.0.1';port=43309;user='root';password='lcup-comprehensive-test-only';datadir=$dataDir;pid=$serverProcess.Id;taskRoot=$taskRoot}
$json=$config | ConvertTo-Json
[IO.File]::WriteAllText((Join-Path $repoRoot 'docs\lcup-comprehensive-verification\disposable-config.json'),$json,(New-Object Text.UTF8Encoding($false)))
Write-Output ('Started fresh isolated MariaDB PID '+$serverProcess.Id+' on port 43309; tests must verify datadir before SQL writes.')
