#!/bin/bash
set -e

# Get current branch
BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Check if on feature branch (PM-NNN/slug)
if ! [[ $BRANCH =~ ^PM-[0-9]+/ ]]; then
  echo "❌ Not on a feature branch. Expected PM-NNN/slug, got: $BRANCH"
  exit 1
fi

# Extract PM number
PM_NUM=$(echo "$BRANCH" | cut -d'/' -f1)

# Find feature directory
FEATURE_DIR=$(find docs/features -maxdepth 1 -type d -name "$PM_NUM-*" | head -1)

if [ -z "$FEATURE_DIR" ]; then
  echo "❌ Feature directory not found for $PM_NUM"
  exit 1
fi

PLAN_FILE="$FEATURE_DIR/plan.md"

if [ ! -f "$PLAN_FILE" ]; then
  echo "❌ plan.md not found at $PLAN_FILE"
  exit 1
fi

TASKS_FILE="$FEATURE_DIR/tasks.md"
TEST_CASES_FILE="$FEATURE_DIR/test-cases.md"
PHASES_DIR="$FEATURE_DIR/phases"

# Same slugify() workflow/run.sh uses, kept identical so phase folder names
# here match the phase branch names /workflow creates.
slugify() {
  echo "$1" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/-\+/-/g' | sed 's/^-\|-$//g'
}

# Extracts one top-level "## <section>" section from plan.md, scoped so a
# stray "### Phase" heading anywhere else in the document can never leak in.
# Rewrites "### Phase N:" sub-headers to "## Phase N:" and numbers each
# checklist item "<id_prefix>-NNN:". Both "Implementation Phases" and
# "Test Cases" use this, per docs/architecture/11-dor.md's requirement that
# they share identical phase headings.
extract_section() {
  local section_name="$1"
  local id_prefix="$2"
  awk -v section="$section_name" -v id_prefix="$id_prefix" '
  BEGIN { counter = 1; in_section = 0; in_phase = 0 }
  /^## / {
    line = $0
    gsub(/[ \t]+$/, "", line)
    in_section = (line == "## " section)
    in_phase = 0
    next
  }
  in_section && /^### Phase [0-9]+:/ {
    in_phase = 1
    gsub(/^### /, "## ", $0)
    print $0
    next
  }
  in_section && in_phase && /^- \[[ x]\]/ {
    sub(/^- \[[ x]\] /, "", $0)
    task_id = sprintf("%s-%03d", id_prefix, counter)
    print "- [ ] " task_id ": " $0
    counter++
    next
  }
  in_section {
    # Continuation lines belonging to the current bullet (code fences,
    # indented detail, blank separators) — copied verbatim so a task with
    # an embedded code block (e.g. a Prisma schema snippet) is not silently
    # truncated to just its first line.
    print
    next
  }
  ' "$PLAN_FILE"
}

# Writes extracted content to a generated file with a title header. Empty
# content means the section was marked Omitted in plan.md (allowed by the
# DoR) — write a placeholder instead of a blank/missing file so downstream
# scripts don't choke on a missing file.
write_generated_file() {
  local raw_content="$1"
  local title="$2"
  local out_file="$3"
  if [ -z "$raw_content" ]; then
    printf '# %s %s\n\n_No content found — check if plan.md marks this section as Omitted (see docs/architecture/11-dor.md)._\n' "$PM_NUM" "$title" >"$out_file"
  else
    printf '# %s %s\n\n%s\n' "$PM_NUM" "$title" "$raw_content" >"$out_file"
  fi
}

# --- tasks.md ---

TASKS_RAW=$(extract_section "Implementation Phases" "B")
write_generated_file "$TASKS_RAW" "Backend Tasks" "$TASKS_FILE"

TOTAL_TASKS=$(grep -c "^- \[ \] [A-Z]-" "$TASKS_FILE" || true)
echo "✅ Generated $TASKS_FILE"
echo "   Total tasks: $TOTAL_TASKS"

# Soft granularity check (warns, never blocks): per docs/architecture/11-dor.md,
# every phase bullet in plan.md should carry a backtick-quoted file path or
# symbol, since this script copies bullets verbatim into tasks.md with zero
# elaboration.
SHALLOW_TASKS=$(grep "^- \[ \] [A-Z]-[0-9]*:" "$TASKS_FILE" | grep -vc '`' || true)
if [ "$SHALLOW_TASKS" -gt 0 ]; then
  echo ""
  echo "⚠️  $SHALLOW_TASKS/$TOTAL_TASKS task(s) have no backtick-quoted file path or symbol — they may be too vague to implement without guessing."
  echo "   Review the corresponding Implementation Phases bullets in $PLAN_FILE against docs/architecture/11-dor.md's granularity rule:"
  grep "^- \[ \] [A-Z]-[0-9]*:" "$TASKS_FILE" | grep -v '`' | sed 's/^/     /'
fi

# --- test-cases.md ---

TEST_CASES_RAW=$(extract_section "Test Cases" "T")
write_generated_file "$TEST_CASES_RAW" "Test Cases" "$TEST_CASES_FILE"

TOTAL_TEST_CASES=$(grep -c "^- \[ \] [A-Z]-" "$TEST_CASES_FILE" || true)
echo "✅ Generated $TEST_CASES_FILE"
echo "   Total test cases: $TOTAL_TEST_CASES"

if [ "$TOTAL_TEST_CASES" -gt 0 ]; then
  SHALLOW_TEST_CASES=$(grep "^- \[ \] [A-Z]-[0-9]*:" "$TEST_CASES_FILE" | grep -vc '`' || true)
  if [ "$SHALLOW_TEST_CASES" -gt 0 ]; then
    echo ""
    echo "⚠️  $SHALLOW_TEST_CASES/$TOTAL_TEST_CASES test case(s) have no backtick-quoted symbol — review against docs/architecture/11-dor.md's Test Cases blueprint."
  fi
fi

# --- Slice both files into phases/phase-N-slug/ ---

slice_by_phase() {
  local source_file="$1"
  local basename="$2"
  local phase_pat="^## Phase ([0-9]+): (.+)$"
  local phase_dir="" buffer=""

  flush() {
    if [ -n "$phase_dir" ]; then
      mkdir -p "$phase_dir"
      printf '%s' "$buffer" >"$phase_dir/$basename"
    fi
  }

  while IFS= read -r line || [ -n "$line" ]; do
    if [[ "$line" =~ $phase_pat ]]; then
      flush
      local phase_num="${BASH_REMATCH[1]}"
      local phase_name="${BASH_REMATCH[2]}"
      local phase_slug
      phase_slug=$(slugify "phase-${phase_num}-${phase_name}")
      phase_dir="$PHASES_DIR/$phase_slug"
      buffer="$line"$'\n'
    elif [ -n "$phase_dir" ]; then
      buffer+="$line"$'\n'
    fi
  done <"$source_file"
  flush
}

slice_by_phase "$TASKS_FILE" "tasks.md"
slice_by_phase "$TEST_CASES_FILE" "test-cases.md"

if [ -d "$PHASES_DIR" ]; then
  PHASE_COUNT=$(find "$PHASES_DIR" -maxdepth 1 -mindepth 1 -type d | wc -l | tr -d ' ')
  echo "✅ Sliced tasks.md and test-cases.md into $PHASE_COUNT phase folder(s) under $PHASES_DIR"

  for d in "$PHASES_DIR"/*/; do
    d="${d%/}"
    [ -f "$d/tasks.md" ] || echo "⚠️  $d has test-cases.md but no tasks.md — phase name mismatch between Implementation Phases and Test Cases in plan.md?"
    [ -f "$d/test-cases.md" ] || echo "⚠️  $d has tasks.md but no test-cases.md — phase name mismatch between Implementation Phases and Test Cases in plan.md?"
  done

  # Copy the whole Blueprints section (Entity/Repository/Use-Case/GraphQL/
  # Domain Events — exact signatures, decision tables, type blocks) into
  # every phase folder verbatim. Byte-identical across phases, so it hits
  # Anthropic's prompt cache from the second phase onward.
  BLUEPRINT_RAW=$(awk '
  /^## Definition of Ready \(DoR\) Blueprints/ { grabbing = 1; next }
  /^## / && grabbing { grabbing = 0 }
  grabbing { print }
  ' "$PLAN_FILE")

  if [ -n "$BLUEPRINT_RAW" ]; then
    for d in "$PHASES_DIR"/*/; do
      d="${d%/}"
      printf '# %s Blueprints (from plan.md, unmodified — same content in every phase folder)\n\n%s\n' "$PM_NUM" "$BLUEPRINT_RAW" >"$d/blueprint.md"
    done
    echo "✅ Copied Blueprints section into every phase folder as blueprint.md"
  else
    echo "⚠️  No '## Definition of Ready (DoR) Blueprints' section found in $PLAN_FILE — phase folders have no blueprint.md. See docs/architecture/11-dor.md."
  fi
fi

# Best-effort: comment test-cases.md on the matching GitHub issue in the
# dedicated tracking repo (financy-project/features), if one exists and gh
# is available. Never blocks the script.
TRACKING_REPO="financy-project/features"
if [ "$TOTAL_TEST_CASES" -gt 0 ]; then
  ISSUE_NUMBER=$(gh issue list -R "$TRACKING_REPO" --search "$PM_NUM" --state all --json number --jq '.[0].number' 2>/dev/null || echo "")
  if [ -n "$ISSUE_NUMBER" ]; then
    if gh issue comment "$ISSUE_NUMBER" -R "$TRACKING_REPO" --body-file "$TEST_CASES_FILE" >/dev/null 2>&1; then
      echo "✅ Posted test-cases.md to issue #$ISSUE_NUMBER"
    else
      echo "⚠️  Failed to post test-cases.md comment (issue #$ISSUE_NUMBER) — post it manually if needed"
    fi
  else
    echo "⚠️  No matching issue found (or gh/remote unavailable) — skipping test-cases.md comment"
  fi
fi

echo ""
echo "🎉 Done. Next: review $TASKS_FILE, then run /workflow to implement phase-by-phase."
