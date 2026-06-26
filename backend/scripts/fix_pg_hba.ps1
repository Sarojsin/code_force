$serviceName = "postgresql-x64-17"
$hbaPath = "C:\Program Files\PostgreSQL\17\data\pg_hba.conf"

Stop-Service $serviceName -Force
Start-Sleep 3

$content = Get-Content $hbaPath -Raw
$content = $content -replace 'host\s+all\s+all\s+127\.0\.0\.1/32\s+scram-sha-256', 'host    all             all             127.0.0.1/32            trust'
$content = $content -replace 'host\s+all\s+all\s+::1/128\s+scram-sha-256', 'host    all             all             ::1/128                 trust'
$content = $content -replace 'local\s+all\s+all\s+scram-sha-256', 'local   all             all                                     trust'
$content | Set-Content $hbaPath -Force

Start-Service $serviceName
Write-Host "PostgreSQL restarted with trust auth"
