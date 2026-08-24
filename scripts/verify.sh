#!/usr/bin/env bash
set -euo pipefail

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
project_dir=$(cd "$script_dir/.." && pwd)

cd "$project_dir"
"$script_dir/dev-db.sh" start
npm --prefix contracts test
npm --prefix contracts run check
node evals/check-golden.mjs
node security/check-red-team.mjs
"$script_dir/test-schema.sh"
"$script_dir/with-java21.sh" ./gradlew test --no-daemon --no-configuration-cache
"$script_dir/backup-restore-verify.sh"
npm --prefix web test
npm --prefix web run build
"$script_dir/security-scan.sh"
node prototype/app/verify-traceability.mjs
node ui-delivery/generate-route-map.mjs --audit
