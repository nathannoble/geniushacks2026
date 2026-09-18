#!/usr/bin/env bash
set -e

MODULES=(orchestrator intake extraction retrieval screening scoring drafting gates eval notifications ui)

mkdir -p app tests
touch app/__init__.py

for m in "${MODULES[@]}"; do
  mkdir -p "app/$m"
  touch "app/$m/__init__.py"
done

echo "Scaffolded: ${MODULES[*]}"