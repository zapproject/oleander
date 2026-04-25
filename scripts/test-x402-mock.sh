#!/bin/sh
set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
COMPOSE_FILE="$ROOT_DIR/docker-compose.x402-mock.yml"

cleanup() {
  docker compose -f "$COMPOSE_FILE" down
}

trap cleanup EXIT INT TERM

echo "Starting x402 mock resource stack..."
docker compose -f "$COMPOSE_FILE" up -d --build x402-resource

echo "Fetching paid claim feed..."
docker compose -f "$COMPOSE_FILE" run --rm sponsor-feed

echo "Running availability witness..."
docker compose -f "$COMPOSE_FILE" run --rm witness-availability

echo "Running attestation witness..."
docker compose -f "$COMPOSE_FILE" run --rm witness-attestation

echo "Running peg witness..."
docker compose -f "$COMPOSE_FILE" run --rm witness-peg

echo "x402 mock scenario completed."
