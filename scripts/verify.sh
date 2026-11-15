#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
mkdir -p test-results
dc() { docker compose -p financial-demo-test -f compose.yaml -f compose.test.yaml --profile test "$@"; }
cleanup() { dc logs --no-color > test-results/services.log; dc down --volumes --remove-orphans; }
dc down --volumes --remove-orphans
trap cleanup EXIT
dc run --rm --build --no-deps backend-tests
dc up -d --build --wait app bank-source card-source wallet-source
dc run --rm --build --no-deps e2e
dc stop app
dc run --rm --no-deps e2e node reset-recovery.js rewind
dc run --rm --no-deps e2e node recovery.js publish recovery-app-offline
dc up -d --wait app
dc run --rm --no-deps e2e node recovery.js assert recovery-app-offline
dc run --rm --no-deps e2e node reset-recovery.js assert
dc stop wallet-source
dc run --rm --no-deps e2e node reset-recovery.js unavailable
dc up -d wallet-source
dc stop postgres
dc run --rm --no-deps e2e node recovery.js publish recovery-database-offline
sleep 20
dc up -d --wait postgres
dc run --rm --no-deps e2e node recovery.js assert recovery-database-offline
dc restart bank-source card-source wallet-source
dc run --rm --no-deps e2e node recovery.js assert recovery-app-offline
docker compose -p financial-demo-test -f compose.yaml -f compose.test.yaml -f compose.live-test.yaml up -d --no-deps bank-source card-source wallet-source
dc run --rm --no-deps e2e node live.js
docker compose -p financial-demo-test -f compose.yaml -f compose.test.yaml -f compose.core.yaml up -d --wait app
dc run --rm --no-deps e2e node core.js
echo 'PASS: Java, browser/API, queued-event recovery, database recovery, replay and core-only checks.'
