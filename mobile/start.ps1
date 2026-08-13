# Auto-detect current WiFi IP and start backend + Expo
$wifiIp = Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias "Wi-Fi" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($null -eq $wifiIp) {
    # Fallback: any non-loopback IPv4 address (Ethernet / virtual adapters)
    $wifiIp = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -notmatch "^(127\.|169\.254\.)" } | Select-Object -First 1
}
if ($null -eq $wifiIp -or -not $wifiIp.IPAddress) {
    Write-Host "ERROR: Could not detect a local IP address. Set EXPO_PUBLIC_API_URL manually."
    exit 1
}
$ip = $wifiIp.IPAddress
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

# Start Admin web app (Vite, port 5173) in a new window
$adminDir = "E:\her_care\web-admin"
if (Test-Path "$adminDir\package.json") {
    Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$adminDir'; npm run dev"
    Write-Host "Started admin web app (new window) -> http://localhost:5173"
} else {
    Write-Host "WARNING: web-admin not found at $adminDir"
}

# Start Expo
npx expo start --dev-client
