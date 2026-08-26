#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
psql_bin="${OPENEMR2026_PSQL_BIN:-/usr/local/opt/postgresql@18/bin/psql}"

"${psql_bin}" -X -h /private/tmp -p 55432 -d openemr2026_dev \
  -f "${repo_dir}/scripts/reset-ai-center-synthetic-data.sql"
