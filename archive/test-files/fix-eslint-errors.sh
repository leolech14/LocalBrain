#!/bin/bash

# Fix ESLint errors automatically where possible
cd /Users/lech/LocalBrain_v0.1

echo "Running ESLint with --fix flag to auto-fix errors..."
pnpm --filter @localbrain/desktop lint:fix

echo "Checking remaining errors..."
pnpm --filter @localbrain/desktop lint