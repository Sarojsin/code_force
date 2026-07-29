# Auto-detect current WiFi IP and start backend + Expo
$ip = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias "Wi-Fi" | Select-Object -First 1).IPAddress
$content = "EXPO_PUBLIC_API_URL=http://${ip}:8000"
Set-Content -Path "E:\her_care\mobile\.env" -Value $content
Write-Host "Set API_URL to http://${ip}:8000"

# Start backend in a new window
$backendDir = "E:\her_care\backend"
$venvActivate = "$backendDir\.venv\Scripts\Activate.ps1"
if (Test-Path $venvActivate) {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "& '$venvActivate'; cd '$backendDir'; uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
    Write-Host "Started backend (new window)"
} else {
    Write-Host "WARNING: Backend venv not found at $venvActivate"
}

# Start Expo
npx expo start --dev-client
