# Auto-detect current WiFi IP and start Expo
$ip = (Get-NetIPAddress -AddressFamily IPv4 -InterfaceAlias "Wi-Fi" | Select-Object -First 1).IPAddress
$content = "EXPO_PUBLIC_API_URL=http://${ip}:8000"
Set-Content -Path "E:\her_care\mobile\.env" -Value $content
Write-Host "Set API_URL to http://${ip}:8000"
npx expo start --dev-client
