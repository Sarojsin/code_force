$ErrorActionPreference = "Stop"
$logFile = "C:\Users\U S E R\AppData\Local\Temp\expo-server.log"

$process = Start-Process -NoNewWindow -FilePath "cmd.exe" -ArgumentList "/c npx expo start --port 8085" -WorkingDirectory "E:\her_care\mobile" -RedirectStandardOutput $logFile -PassThru
Write-Output "Expo server PID: $($process.Id)"
Write-Output "Log file: $logFile"
Write-Output "Waiting for server to start..."
Start-Sleep 20

if (Test-Path $logFile) {
    Get-Content $logFile -Tail 30
}
