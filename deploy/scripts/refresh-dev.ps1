param(
  [string]$ComposeFile = "deploy/docker-compose.yml",
  [int]$TimeoutSec = 180
)

$ErrorActionPreference = "Stop"

function Get-RepoRoot {
  # This script lives at deploy/scripts/refresh-dev.ps1
  $here = Resolve-Path -LiteralPath $PSScriptRoot
  return (Resolve-Path -LiteralPath (Join-Path $here "..\\..")).Path
}

function Get-DotEnvValue([string]$Path, [string]$Key) {
  if (-not (Test-Path -LiteralPath $Path)) {
    return $null
  }

  foreach ($line in Get-Content -LiteralPath $Path -ErrorAction SilentlyContinue) {
    $trimmed = $line.Trim()
    if (-not $trimmed) { continue }
    if ($trimmed.StartsWith("#")) { continue }

    $idx = $trimmed.IndexOf("=")
    if ($idx -lt 1) { continue }

    $k = $trimmed.Substring(0, $idx).Trim()
    if ($k -ne $Key) { continue }

    return $trimmed.Substring($idx + 1).Trim()
  }

  return $null
}

function Invoke-HealthCheck([string]$Url) {
  try {
    $resp = Invoke-WebRequest -UseBasicParsing -TimeoutSec 5 -Uri $Url
    $content = $resp.Content
    if ($content -is [byte[]]) {
      $content = [Text.Encoding]::UTF8.GetString($content)
    }
    return @{
      ok = $true
      status = [int]$resp.StatusCode
      content = ($content | Out-String).Trim()
    }
  } catch {
    return @{
      ok = $false
      status = 0
      content = $_.Exception.Message
    }
  }
}

$root = Get-RepoRoot
Set-Location -LiteralPath $root

$composePath = Join-Path $root $ComposeFile
if (-not (Test-Path -LiteralPath $composePath)) {
  throw "compose file not found: $composePath"
}

$nginxPort = 18080
if ($env:NGINX_PORT) {
  $nginxPort = [int]$env:NGINX_PORT
} else {
  $dotEnvPort = Get-DotEnvValue -Path (Join-Path $root "deploy/.env") -Key "NGINX_PORT"
  if ($dotEnvPort) {
    $nginxPort = [int]$dotEnvPort
  }
}

Write-Host "[docker-refresh] compose: $composePath"
Write-Host "[docker-refresh] gateway port: $nginxPort"

$services = @("backend", "frontend", "nginx", "celery_worker", "celery_beat")

& docker compose -f $composePath up -d --build --force-recreate @services
if ($LASTEXITCODE -ne 0) {
  exit $LASTEXITCODE
}

$deadline = (Get-Date).AddSeconds($TimeoutSec)
$last = $null
while ((Get-Date) -lt $deadline) {
  $healthGateway = Invoke-HealthCheck -Url ("http://127.0.0.1:{0}/healthz" -f $nginxPort)
  $healthBackend = Invoke-HealthCheck -Url ("http://127.0.0.1:{0}/api/healthz" -f $nginxPort)

  $last = @{
    gateway = $healthGateway
    backend = $healthBackend
  }

  $gatewayOk = $healthGateway.ok -and ($healthGateway.content -match '(?i)\bok\b')
  $backendOk = $healthBackend.ok -and ($healthBackend.content -match '"status"\s*:\s*"ok"')

  if ($gatewayOk -and $backendOk) {
    Write-Host "[docker-refresh] OK: /healthz=$($healthGateway.content) /api/healthz=$($healthBackend.content)"
    exit 0
  }

  Start-Sleep -Seconds 2
}

Write-Error ("[docker-refresh] FAILED: /healthz=({0}) {1}; /api/healthz=({2}) {3}" -f `
  $last.gateway.status, $last.gateway.content, $last.backend.status, $last.backend.content)
exit 1
