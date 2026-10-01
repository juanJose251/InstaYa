$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

if (-not (Get-NetTCPConnection -LocalPort 4000 -State Listen -ErrorAction SilentlyContinue)) {
    Start-Process -FilePath "node" -ArgumentList "node_modules/tsx/dist/cli.mjs","watch","src/server.ts" -WorkingDirectory "$root\backend" -WindowStyle Hidden -RedirectStandardOutput "$root\backend\server.log" -RedirectStandardError "$root\backend\server-err.log"
    Write-Host "Backend iniciado en http://localhost:4000"
} else {
    Write-Host "Backend ya estaba corriendo en :4000"
}

if (-not (Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue)) {
    Start-Process -FilePath "node" -ArgumentList "node_modules/vite/bin/vite.js" -WorkingDirectory "$root\frontend" -WindowStyle Hidden -RedirectStandardOutput "$root\frontend\vite.log" -RedirectStandardError "$root\frontend\vite-err.log"
    Write-Host "Frontend iniciado en http://localhost:5173"
} else {
    Write-Host "Frontend ya estaba corriendo en :5173"
}