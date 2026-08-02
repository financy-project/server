#!/bin/bash
set -e

# Marks a single task or test case done in both its flat top-level file
# (tasks.md/test-cases.md) and its per-phase slice, then stages both (no
# commit — rides along in the phase agent's own next /commit-skill commit
# for that task). Called by the phase agent itself as it finishes each item
# (see PHASE_PROMPT in workflow/run.sh), not by run.sh — run.sh only
# verifies at the end of the phase that everything pending got marked.
#
# Usage: mark-done.sh <PM-NNN> <ID>
#   ID is B-NNN (marks tasks.md + phases/*/tasks.md)
#      or T-NNN (marks test-cases.md + phases/*/test-cases.md)

PM_NUM="$1"
ID="$2"

if [ -z "$PM_NUM" ] || [ -z "$ID" ]; then
  echo "Usage: mark-done.sh <PM-NNN> <B-NNN|T-NNN>" >&2
  exit 1
fi

FEATURE_DIR=$(find docs/features -maxdepth 1 -type d -name "$PM_NUM-*" | head -1)
if [ -z "$FEATURE_DIR" ]; then
  echo "❌ Feature directory not found for $PM_NUM" >&2
  exit 1
fi

case "$ID" in
  B-*)
    FLAT_FILE="$FEATURE_DIR/tasks.md"
    SLICE_BASENAME="tasks.md"
    ;;
  T-*)
    FLAT_FILE="$FEATURE_DIR/test-cases.md"
    SLICE_BASENAME="test-cases.md"
    ;;
  *)
    echo "❌ Unrecognized id '$ID' — expected B-NNN (task) or T-NNN (test case)" >&2
    exit 1
    ;;
esac

MARKED=0

if [ -f "$FLAT_FILE" ] && grep -q "^- \[ \] $ID:" "$FLAT_FILE"; then
  sed -i "s/^- \[ \] $ID:/- [x] $ID:/" "$FLAT_FILE"
  git add "$FLAT_FILE"
  MARKED=1
fi

SLICE_FILE=$(grep -rl "^- \[ \] $ID:" "$FEATURE_DIR"/phases/*/"$SLICE_BASENAME" 2>/dev/null | head -1)
if [ -n "$SLICE_FILE" ]; then
  sed -i "s/^- \[ \] $ID:/- [x] $ID:/" "$SLICE_FILE"
  git add "$SLICE_FILE"
  MARKED=1
fi

if [ "$MARKED" -eq 1 ]; then
  echo "✅ Marked $ID done in $FLAT_FILE and its phase slice"
else
  echo "⚠️  $ID not found as a pending checkbox in $FLAT_FILE or any phases/*/$SLICE_BASENAME" >&2
  exit 1
fi
