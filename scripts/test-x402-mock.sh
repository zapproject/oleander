#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
COMPOSE_FILE="$ROOT_DIR/docker-compose.x402-mock.yml"

export ZAP_SPONSORED_CLAIM_FEED="${ZAP_SPONSORED_CLAIM_FEED:-claims/x402-fifty-claims.json}"
export X402_SPONSOR_ID="${X402_SPONSOR_ID:-sponsor:x402:mock}"
export X402_BOUNTY_ATOMIC="${X402_BOUNTY_ATOMIC:-1000000}"
export ZAP_REWARD_ATOMIC="${ZAP_REWARD_ATOMIC:-1000000000000000000}"

cleanup() {
  docker compose -f "$COMPOSE_FILE" down
}

trap cleanup EXIT INT TERM

echo "Starting x402 mock resource stack..."
docker compose -f "$COMPOSE_FILE" build
docker compose -f "$COMPOSE_FILE" up -d x402-resource

echo "Sponsor funds and publishes paid claim feed: $ZAP_SPONSORED_CLAIM_FEED"
docker compose -f "$COMPOSE_FILE" run --rm sponsor-feed

echo "Running availability oracle with OUSD/ZAP incentives..."
docker compose -f "$COMPOSE_FILE" run --rm witness-availability

echo "Running attestation oracle with OUSD/ZAP incentives..."
docker compose -f "$COMPOSE_FILE" run --rm witness-attestation

echo "Running peg oracle with OUSD/ZAP incentives..."
docker compose -f "$COMPOSE_FILE" run --rm witness-peg

echo "x402 mock scenario completed."
