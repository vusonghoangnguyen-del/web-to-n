$ErrorActionPreference = 'Stop'

$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..\..'))
$envFile = Join-Path $projectRoot '.env'
$backupDir = [IO.Path]::GetFullPath((Join-Path $projectRoot 'backups'))

if (-not (Test-Path -LiteralPath $envFile)) { throw 'Không tìm thấy file .env.' }
if (-not $backupDir.StartsWith($projectRoot + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
  throw 'Thư mục backup nằm ngoài dự án.'
}

$config = @{}
Get-Content -LiteralPath $envFile -Encoding utf8 | ForEach-Object {
  if ($_ -match '^([^#=]+)=(.*)$') { $config[$matches[1].Trim()] = $matches[2].Trim() }
}
foreach ($key in @('DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD')) {
  if (-not $config[$key]) { throw "Thiếu $key trong file .env." }
}

$dumpCommand = Get-Command mysqldump -ErrorAction SilentlyContinue
$dumpPath = if ($dumpCommand) { $dumpCommand.Source } else { 'C:\Program Files\MySQL\MySQL Server 26.10\bin\mysqldump.exe' }
if (-not (Test-Path -LiteralPath $dumpPath)) {
  throw 'Không tìm thấy mysqldump. Hãy thêm thư mục bin của MySQL vào PATH.'
}

New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backupFile = Join-Path $backupDir "$($config['DB_NAME'])-$stamp.sql"
# MySQL 26.10 không ghi được trực tiếp tới đường dẫn Unicode, nên dump qua TEMP.
$tempFile = Join-Path $env:TEMP "$($config['DB_NAME'])-$stamp.sql"

try {
  $env:MYSQL_PWD = $config['DB_PASSWORD']
  & $dumpPath `
    "--host=$($config['DB_HOST'])" `
    "--port=$($config['DB_PORT'])" `
    "--user=$($config['DB_USER'])" `
    --single-transaction `
    --skip-lock-tables `
    --skip-add-locks `
    --set-gtid-purged=OFF `
    --skip-masking-policies `
    --no-tablespaces `
    --default-character-set=utf8mb4 `
    --databases $config['DB_NAME'] `
    "--result-file=$tempFile"

  if ($LASTEXITCODE -ne 0) { throw "mysqldump kết thúc với mã lỗi $LASTEXITCODE." }
  Move-Item -LiteralPath $tempFile -Destination $backupFile
  $content = Get-Content -LiteralPath $backupFile -Raw -Encoding utf8
  if ($content -notmatch 'Dump completed on') { throw 'File backup không có dấu hoàn thành của mysqldump.' }

  $file = Get-Item -LiteralPath $backupFile
  $tableCount = ([regex]::Matches($content, 'CREATE TABLE')).Count
  Write-Host "Backup thành công: $($file.FullName)"
  Write-Host "Kích thước: $($file.Length) bytes; số bảng: $tableCount"
} finally {
  Remove-Item Env:MYSQL_PWD -ErrorAction SilentlyContinue
  if (Test-Path -LiteralPath $tempFile) { Remove-Item -LiteralPath $tempFile }
}
