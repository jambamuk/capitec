$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
New-Item -ItemType Directory -Force test-results | Out-Null
$composeArgs = @('compose', '-p', 'financial-demo-test', '-f', 'compose.yaml', '-f', 'compose.test.yaml', '--profile', 'test')
function Invoke-Compose {
    & docker @composeArgs @args
    if ($LASTEXITCODE -ne 0) { throw "Docker Compose failed: $args" }
}
# Only this dedicated test project's disposable volumes are reset.
Invoke-Compose down --volumes --remove-orphans
try {
    Invoke-Compose run --rm --build --no-deps backend-tests
    Invoke-Compose up -d --build --wait app bank-source card-source wallet-source
    Invoke-Compose run --rm --build --no-deps e2e
    Invoke-Compose stop app
    Invoke-Compose run --rm --no-deps e2e node reset-recovery.js rewind
    Invoke-Compose run --rm --no-deps e2e node recovery.js publish recovery-app-offline
    Invoke-Compose up -d --wait app
    Invoke-Compose run --rm --no-deps e2e node recovery.js assert recovery-app-offline
    Invoke-Compose run --rm --no-deps e2e node reset-recovery.js assert
    Invoke-Compose stop wallet-source
    Invoke-Compose run --rm --no-deps e2e node reset-recovery.js unavailable
    Invoke-Compose up -d wallet-source
    Invoke-Compose stop postgres
    Invoke-Compose run --rm --no-deps e2e node recovery.js publish recovery-database-offline
    Start-Sleep -Seconds 20
    Invoke-Compose up -d --wait postgres
    Invoke-Compose run --rm --no-deps e2e node recovery.js assert recovery-database-offline
    Invoke-Compose restart bank-source card-source wallet-source
    Invoke-Compose run --rm --no-deps e2e node recovery.js assert recovery-app-offline
    & docker compose -p financial-demo-test -f compose.yaml -f compose.test.yaml -f compose.live-test.yaml up -d --no-deps bank-source card-source wallet-source
    if ($LASTEXITCODE -ne 0) { throw 'Continuous sources failed to start' }
    Invoke-Compose run --rm --no-deps e2e node live.js
    & docker compose -p financial-demo-test -f compose.yaml -f compose.test.yaml -f compose.core.yaml up -d --wait app
    if ($LASTEXITCODE -ne 0) { throw 'Core-only application failed to start' }
    Invoke-Compose run --rm --no-deps e2e node core.js
    Write-Host 'PASS: Java, browser/API, queued-event recovery, database recovery and replay checks.'
} finally {
    & docker @composeArgs logs --no-color > test-results/services.log
    Invoke-Compose down --volumes --remove-orphans
}
