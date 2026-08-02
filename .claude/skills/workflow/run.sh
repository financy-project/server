#!/bin/bash
set -e
set -o pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

FEATURE_BRANCH=$(git rev-parse --abbrev-ref HEAD)

if ! [[ $FEATURE_BRANCH =~ ^PM-[0-9]+/ ]]; then
  echo -e "${RED}❌ Not on a feature branch. Expected PM-NNN/slug, got: $FEATURE_BRANCH${NC}"
  exit 1
fi

PM_NUM=$(echo "$FEATURE_BRANCH" | cut -d'/' -f1)

FEATURE_DIR=$(find docs/features -maxdepth 1 -type d -name "$PM_NUM-*" | head -1)
if [ -z "$FEATURE_DIR" ]; then
  echo -e "${RED}❌ Feature directory not found for $PM_NUM${NC}"
  exit 1
fi

TASKS_FILE="$FEATURE_DIR/tasks.md"
PROGRESS_FILE="$FEATURE_DIR/progress.txt"
PHASES_DIR="$FEATURE_DIR/phases"

if [ ! -f "$TASKS_FILE" ]; then
  echo -e "${RED}❌ tasks.md not found at $TASKS_FILE${NC}"
  exit 1
fi

[ -f "$PROGRESS_FILE" ] || touch "$PROGRESS_FILE"

PLAN_FILE="$FEATURE_DIR/plan.md"

if [ ! -f "$PLAN_FILE" ]; then
  echo -e "${RED}❌ DoR validation failed: plan.md not found at $PLAN_FILE.${NC}"
  echo -e "${RED}   Please generate a plan using /feature-plan to ensure DoR is met before running workflow.${NC}"
  exit 1
fi

MAX_ITERATIONS=${1:-10}
ITERATION=0

# Built once, outside the loop: this becomes the --append-system-prompt for
# every phase invocation. Its content is byte-identical across all phases in
# this run, so after phase 1 pays full price, phases 2..N hit Anthropic's
# prompt cache for this entire block instead of the agent re-reading the
# checklist (and often exploring other modules "to confirm") on every phase.
CHECKLIST_CONTENT=$(cat docs/architecture/13-backend-development-checklist.md)
STATIC_SYSTEM_PROMPT="$(cat .claude/agents/backend-engineer.md)

---

# Backend Development Checklist (already loaded — do NOT re-read this file, do NOT open docs/architecture/*.md, and do NOT grep other modules for patterns. This is the complete, current playbook covering every layer with concrete examples. Only fall back to exploring the codebase if something is genuinely ambiguous after reading this.)

$CHECKLIST_CONTENT"

# Convert string to kebab-case slug
slugify() {
  echo "$1" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/-\+/-/g' | sed 's/^-\|-$//g'
}

# Push a branch with retries on increasing backoff (15s, 30s, 45s).
# Never blocks the workflow: after exhausting retries it logs a clear
# warning and returns failure, but the caller continues regardless.
push_with_retry() {
  local branch="$1"
  local delays=(15 30 45)

  if git push -u origin "$branch"; then
    return 0
  fi

  for delay in "${delays[@]}"; do
    echo -e "${YELLOW}⚠️  Push of $branch failed. Retrying in ${delay}s...${NC}"
    sleep "$delay"
    if git push -u origin "$branch"; then
      echo -e "${GREEN}✅ Push of $branch succeeded on retry${NC}"
      return 0
    fi
  done

  echo -e "${RED}⚠️  Push of $branch failed after 3 retries (15s/30s/45s). Continuing locally — this branch is out of sync with origin until a future push succeeds.${NC}"

  if [ -n "${PROGRESS_FILE:-}" ]; then
    {
      echo ""
      echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠️  PUSH FAILED: $branch (after 3 retries)"
      echo "  Branch is out of sync with origin. Its PR may be missing or stale,"
      echo "  and downstream phase PRs targeting it may also fail to create."
      echo "  Re-run /workflow or push '$branch' manually to recover."
    } >> "$PROGRESS_FILE"
  fi

  return 1
}

# Get all tasks (pending and done) for a given phase number
get_phase_tasks() {
  local phase_num="$1"
  local in_phase=false
  local phase_pat="^## Phase ${phase_num}:"
  local next_pat="^## Phase [0-9]"
  local task_pat="^- \["
  while IFS= read -r line; do
    if [[ "$line" =~ $phase_pat ]]; then
      in_phase=true; continue
    fi
    if [ "$in_phase" = true ]; then
      [[ "$line" =~ $next_pat ]] && break
      [[ "$line" =~ $task_pat ]] && echo "$line"
    fi
  done < "$TASKS_FILE"
}

# Get only pending tasks for a given phase number
get_pending_tasks() {
  get_phase_tasks "$1" | grep "^- \[ \] B-" || true
}

echo -e "${BLUE}🚀 Starting phase workflow for $FEATURE_BRANCH${NC}"
echo -e "${BLUE}📋 Tasks file: $TASKS_FILE${NC}"
echo ""

# Ensure the top-level PR (main <- feature_branch) exists.
echo -e "${BLUE}📤 Ensuring $FEATURE_BRANCH is pushed and has a PR into main...${NC}"
push_with_retry "$FEATURE_BRANCH" || true

EXISTING_FEATURE_PR=$(gh pr list --head "$FEATURE_BRANCH" --base main --state all --json number --jq '.[0].number' 2>/dev/null || echo "")
if [ -z "$EXISTING_FEATURE_PR" ]; then
  echo -e "${BLUE}🔀 Creating PR: $FEATURE_BRANCH → main${NC}"
  FEATURE_TITLE=$(basename "$FEATURE_DIR" | sed "s/^$PM_NUM-//" | tr '-' ' ')
  gh pr create \
    --base main \
    --head "$FEATURE_BRANCH" \
    --title "feat($PM_NUM): $FEATURE_TITLE" \
    --body "$(cat <<PRBODY
## Summary

$PM_NUM — tracks the full stacked implementation. Phase PRs merge down
into this branch as they complete; this PR delivers the finished
feature to \`main\` once the stack is done.

## Test plan

- [ ] All phase PRs merged down into this branch
- [ ] \`pnpm test\` passes
- [ ] \`pnpm build\` compiles without errors
PRBODY
)" || echo -e "${YELLOW}⚠️  PR creation failed (may already exist)${NC}"
else
  echo -e "${YELLOW}📍 PR already exists: #$EXISTING_FEATURE_PR ($FEATURE_BRANCH → main)${NC}"
fi
echo ""

# Initialize stack pointer to the last completed phase branch (if any).
PREV_PHASE_BRANCH="$FEATURE_BRANCH"
LAST_COMPLETED_PHASE=0
DETECT_PAT="^## Phase ([0-9]+): (.+)$"
while IFS= read -r line; do
  if [[ "$line" =~ $DETECT_PAT ]]; then
    PHASE_N="${BASH_REMATCH[1]}"
    PHASE_NAME_CANDIDATE="${BASH_REMATCH[2]}"
    PHASE_SLUG_CANDIDATE=$(slugify "phase-${PHASE_N}-${PHASE_NAME_CANDIDATE}")
    PHASE_BRANCH_CANDIDATE="${PM_NUM}/${PHASE_SLUG_CANDIDATE}"

    if ! git rev-parse --verify "$PHASE_BRANCH_CANDIDATE" >/dev/null 2>&1; then
      break
    fi

    BRANCH_TASKS=$(git show "$PHASE_BRANCH_CANDIDATE:$TASKS_FILE" 2>/dev/null | get_phase_tasks "$PHASE_N" || echo "")
    BRANCH_PENDING=$(echo "$BRANCH_TASKS" | grep "^- \[ \] B-" || true)

    if [ -n "$BRANCH_TASKS" ] && [ -z "$BRANCH_PENDING" ]; then
      LAST_COMPLETED_PHASE="$PHASE_N"
      PREV_PHASE_BRANCH="$PHASE_BRANCH_CANDIDATE"
    else
      break
    fi
  fi
done < "$TASKS_FILE"

if [ "$LAST_COMPLETED_PHASE" -gt 0 ]; then
  echo -e "${BLUE}📍 Resuming stack from: $PREV_PHASE_BRANCH (last completed phase, per its own tasks.md)${NC}"
else
  echo -e "${BLUE}📍 Starting stack from: $PREV_PHASE_BRANCH (feature branch)${NC}"
fi
echo ""

while [ $ITERATION -lt $MAX_ITERATIONS ]; do
  ITERATION=$((ITERATION + 1))

  CURRENT_PHASE_NUM=""
  CURRENT_PHASE_NAME=""
  PHASE_HAS_PENDING=false
  PHASE_HDR_PAT="^## Phase ([0-9]+): (.+)$"
  PENDING_TASK_PAT="^- \[ \] B-"

  while IFS= read -r line; do
    if [[ "$line" =~ $PHASE_HDR_PAT ]]; then
      [ "$PHASE_HAS_PENDING" = true ] && break
      CURRENT_PHASE_NUM="${BASH_REMATCH[1]}"
      CURRENT_PHASE_NAME="${BASH_REMATCH[2]}"
      PHASE_HAS_PENDING=false
    fi
    [[ "$line" =~ $PENDING_TASK_PAT ]] && PHASE_HAS_PENDING=true
  done < "$TASKS_FILE"

  if [ "$PHASE_HAS_PENDING" = false ] || [ -z "$CURRENT_PHASE_NUM" ]; then
    echo -e "${GREEN}✅ All phases complete!${NC}"
    break
  fi

  PENDING_TASKS=$(get_pending_tasks "$CURRENT_PHASE_NUM")
  [ -z "$PENDING_TASKS" ] && { echo -e "${GREEN}✅ All phases complete!${NC}"; break; }

  PHASE_SLUG=$(slugify "phase-${CURRENT_PHASE_NUM}-${CURRENT_PHASE_NAME}")
  PHASE_BRANCH="${PM_NUM}/${PHASE_SLUG}"

  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${BLUE}Iteration $ITERATION: Phase $CURRENT_PHASE_NUM — $CURRENT_PHASE_NAME${NC}"
  echo -e "${BLUE}Branch: $PHASE_BRANCH  (base: $PREV_PHASE_BRANCH)${NC}"
  echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo "Pending tasks:"
  echo "$PENDING_TASKS"
  echo ""

  echo -e "${BLUE}📌 Creating phase branch: $PHASE_BRANCH${NC}"
  git checkout "$PREV_PHASE_BRANCH"
  git checkout -b "$PHASE_BRANCH" 2>/dev/null || git checkout "$PHASE_BRANCH"

  MERGE_BASE=$(git merge-base "$PHASE_BRANCH" "$PREV_PHASE_BRANCH")
  PREV_BRANCH_HEAD=$(git rev-parse "$PREV_PHASE_BRANCH")
  if [ "$MERGE_BASE" != "$PREV_BRANCH_HEAD" ]; then
    echo -e "${YELLOW}⚠️  Phase branch is not stacked on $PREV_PHASE_BRANCH. Rebasing...${NC}"
    git rebase "$PREV_PHASE_BRANCH" || {
      echo -e "${RED}❌ Rebase failed. Fix conflicts manually and retry.${NC}"
      git checkout "$FEATURE_BRANCH"
      exit 1
    }
  fi

  PHASE_BRANCH_EXISTS=$(git rev-parse --verify "$PHASE_BRANCH" 2>/dev/null || echo "")
  if [ -n "$PHASE_BRANCH_EXISTS" ]; then
    echo -e "${YELLOW}📍 Phase branch already exists: $PHASE_BRANCH${NC}"

    PHASE_BRANCH_TASKS=$(git show "$PHASE_BRANCH:$TASKS_FILE" 2>/dev/null | get_phase_tasks "$CURRENT_PHASE_NUM" || echo "")
    PHASE_BRANCH_PENDING=$(echo "$PHASE_BRANCH_TASKS" | grep "^- \[ \] B-" || true)

    if [ -z "$PHASE_BRANCH_PENDING" ] && [ -n "$PHASE_BRANCH_TASKS" ]; then
      echo -e "${GREEN}✅ Phase $CURRENT_PHASE_NUM already complete on branch $PHASE_BRANCH${NC}"
      git checkout "$PHASE_BRANCH"
      PREV_PHASE_BRANCH="$PHASE_BRANCH"
      echo ""
      continue
    fi
  fi

  echo -e "${BLUE}🤖 Spawning Claude to implement Phase $CURRENT_PHASE_NUM...${NC}"
  echo ""

  PHASE_DIR="$PHASES_DIR/$PHASE_SLUG"
  if [ -d "$PHASE_DIR" ]; then
    PHASE_SCOPED_DOCS="## This Phase's Tasks (from phases/$PHASE_SLUG/tasks.md)
\`\`\`
$(cat "$PHASE_DIR/tasks.md" 2>/dev/null || echo "(missing)")
\`\`\`

## This Phase's Test Cases (from phases/$PHASE_SLUG/test-cases.md)
\`\`\`
$(cat "$PHASE_DIR/test-cases.md" 2>/dev/null || echo "(none documented for this phase)")
\`\`\`

## Blueprints (from phases/$PHASE_SLUG/blueprint.md — exact signatures, decision tables, type blocks; same content every phase)
\`\`\`
$(cat "$PHASE_DIR/blueprint.md" 2>/dev/null || echo "(none — see plan.md directly if you need a signature)")
\`\`\`"
  else
    echo -e "${YELLOW}⚠️  No phases/$PHASE_SLUG/ found — falling back to the full tasks.md (re-run /feature-task to generate phase-scoped docs)${NC}"
    PHASE_SCOPED_DOCS="## Full tasks.md (for context)
\`\`\`
$(cat "$TASKS_FILE")
\`\`\`"
  fi

  PRIOR_EXPORTS=$(grep -A 50 "^  Exports:" "$PROGRESS_FILE" 2>/dev/null || echo "")

  PHASE_PROMPT=$(cat <<EOF
You are working on a backend feature. Implement ALL pending tasks for Phase $CURRENT_PHASE_NUM: $CURRENT_PHASE_NAME.

## Pending Tasks to Implement (in order)
$PENDING_TASKS

$PHASE_SCOPED_DOCS

## What Prior Phases Exported (from progress.txt — real signatures already implemented; read the actual file with Read/Grep if you need more than this)
\`\`\`
${PRIOR_EXPORTS:-(none — this is the first phase)}
\`\`\`

## Instructions
The backend development checklist (layer-by-layer guide with code examples)
is already loaded in your system prompt. Do not re-read it, do not open
docs/architecture/*.md, and do not grep other modules for patterns — follow
the checklist directly.

For EACH pending task, in order:
1. Write a failing test first (TDD) — check "This Phase's Test Cases" for the
   exact T-NNN case(s) this covers
2. Implement the code to make the test pass
3. Run \`pnpm test\` to confirm tests pass
4. Mark everything you just finished done — do NOT edit tasks.md/test-cases.md
   by hand, always use the script:
   \`bash .claude/skills/workflow/mark-done.sh $PM_NUM <ID>\`
   Call it once for the task's own B-NNN id, and once per T-NNN test case you
   just satisfied. This checks the box in both the flat file and its phase
   slice and stages the change so it rides along in the commit below.
5. Commit with a semantic message using the /commit skill (one commit per task)

After all tasks: run \`pnpm build\` to verify clean compilation.

## Acceptance Criteria
- Every pending task has its own commit
- All tests pass (\`pnpm test\`)
- Build succeeds (\`pnpm build\`)
- Follows all architectural conventions from CLAUDE.md and constitution.md

When ALL tasks are complete, end your reply with "✅ PHASE COMPLETE" followed
by an "## Exports" section listing the exact signatures you added this phase
(one per line, e.g. \`Transaction.create(props: TransactionProps): Transaction\`)
— this is how the next phase finds out what you built without re-reading your
source files.
EOF
)

  TEMP_SETTINGS=$(mktemp)
  PHASE_OUTPUT="$FEATURE_DIR/phase-$CURRENT_PHASE_NUM-output.log"

  cat > "$TEMP_SETTINGS" << 'SETTINGS_EOF'
{
  "permissions": {
    "global": {
      "Bash": "allow",
      "Edit": "allow",
      "Write": "allow",
      "Read": "allow",
      "Agent": "allow",
      "Skill": "allow"
    }
  }
}
SETTINGS_EOF

  export CLAUDE_SKIP_PERMISSIONS=1
  echo "$PHASE_PROMPT" | claude \
    --dangerously-skip-permissions \
    --settings "$TEMP_SETTINGS" \
    --print \
    --append-system-prompt "$STATIC_SYSTEM_PROMPT" \
    2>&1 | tee "$PHASE_OUTPUT" \
    || {
      CLAUDE_EXIT=$?
      echo -e "${RED}❌ Claude failed (exit code: $CLAUDE_EXIT). Check $PHASE_OUTPUT for details.${NC}"
      rm -f "$TEMP_SETTINGS"
      git checkout "$FEATURE_BRANCH"
      exit 1
    }

  tail -n 500 "$PHASE_OUTPUT"

  if ! grep -qi "PHASE COMPLETE\|✅.*complete" "$PHASE_OUTPUT" 2>/dev/null; then
    echo -e "${YELLOW}⚠️  No explicit completion marker found. Checking if phase was already complete...${NC}"

    CURRENT_PENDING=$(get_pending_tasks "$CURRENT_PHASE_NUM")
    if [ -z "$CURRENT_PENDING" ]; then
      echo -e "${GREEN}✅ Phase $CURRENT_PHASE_NUM tasks are all complete (agent detected pre-completion)${NC}"
    else
      echo -e "${RED}❌ Claude did not complete phase. Check $PHASE_OUTPUT for details.${NC}"
      rm -f "$TEMP_SETTINGS"
      git checkout "$FEATURE_BRANCH"
      exit 1
    fi
  fi

  rm -f "$TEMP_SETTINGS"
  unset CLAUDE_SKIP_PERMISSIONS
  echo ""
  echo -e "${BLUE}✅ Phase $CURRENT_PHASE_NUM implementation complete${NC}"

  UNMARKED_TASKS=""
  while IFS= read -r task_line; do
    TASK_ID=$(echo "$task_line" | grep -o 'B-[0-9]*' | head -1)
    [ -n "$TASK_ID" ] && grep -q "^- \[ \] $TASK_ID:" "$TASKS_FILE" && UNMARKED_TASKS="$UNMARKED_TASKS $TASK_ID"
  done <<< "$PENDING_TASKS"

  if [ -n "$UNMARKED_TASKS" ]; then
    echo -e "${YELLOW}⚠️  Agent reported PHASE COMPLETE but didn't mark via mark-done.sh:$UNMARKED_TASKS — marking now as a fallback. Check $PHASE_OUTPUT.${NC}"
    for TASK_ID in $UNMARKED_TASKS; do
      sed -i "s/^- \[ \] $TASK_ID:/- [x] $TASK_ID:/" "$TASKS_FILE"
    done
  else
    echo -e "${BLUE}📝 All Phase $CURRENT_PHASE_NUM tasks were already marked complete by the agent${NC}"
  fi

  EXPORTS_BLOCK=$(awk '
    /^## Exports/ { capturing = 1; buf = ""; next }
    capturing && /^$/ { capturing = 0 }
    capturing { buf = buf $0 "\n" }
    END { printf "%s", buf }
  ' "$PHASE_OUTPUT")

  TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
  {
    echo ""
    echo "[$TIMESTAMP] ✅ Phase $CURRENT_PHASE_NUM: $CURRENT_PHASE_NAME"
    echo "  Branch: $PHASE_BRANCH"
    echo "$PENDING_TASKS" | while IFS= read -r t; do echo "  $t"; done
    if [ -n "$EXPORTS_BLOCK" ]; then
      echo "  Exports:"
      echo "$EXPORTS_BLOCK" | sed 's/^/    /'
    fi
  } >> "$PROGRESS_FILE"

  git add "$TASKS_FILE" "$PROGRESS_FILE" 2>/dev/null || true
  git diff --cached --quiet || git commit -m "chore(workflow): mark phase $CURRENT_PHASE_NUM tasks as complete"

  COMPLETED=$(grep -c "^- \[x\] B-" "$TASKS_FILE" || echo 0)
  TOTAL=$(grep -c "^- \[" "$TASKS_FILE" || echo 0)
  echo -e "${GREEN}📊 Progress: $COMPLETED/$TOTAL tasks completed${NC}"
  echo ""

  echo -e "${BLUE}📤 Pushing base branch $PREV_PHASE_BRANCH to remote${NC}"
  push_with_retry "$PREV_PHASE_BRANCH" || true

  echo -e "${BLUE}📤 Pushing $PHASE_BRANCH to remote${NC}"
  push_with_retry "$PHASE_BRANCH" || true

  echo -e "${BLUE}🔀 Creating PR: $PHASE_BRANCH → $PREV_PHASE_BRANCH${NC}"
  TASK_LIST=$(echo "$PENDING_TASKS" | sed 's/^- \[ \] /- /' | sed 's/^- \[x\] /- /')
  gh pr create \
    --base "$PREV_PHASE_BRANCH" \
    --head "$PHASE_BRANCH" \
    --title "feat($PM_NUM/phase-$CURRENT_PHASE_NUM): $CURRENT_PHASE_NAME" \
    --body "$(cat <<PRBODY
## Summary

Phase $CURRENT_PHASE_NUM of $PM_NUM — $CURRENT_PHASE_NAME.

## Tasks implemented

$TASK_LIST

## Part of stack

> **$PM_NUM** · Phase $CURRENT_PHASE_NUM · base: \`$PREV_PHASE_BRANCH\`

## Test plan

- [ ] \`pnpm test\` passes
- [ ] \`pnpm build\` compiles without errors
PRBODY
)" || echo -e "${YELLOW}⚠️  PR creation failed (may already exist)${NC}"

  PREV_PHASE_BRANCH="$PHASE_BRANCH"
done

if [ $ITERATION -eq $MAX_ITERATIONS ]; then
  echo -e "${YELLOW}⚠️  Reached max iterations ($MAX_ITERATIONS)${NC}"
  exit 1
fi

echo ""
echo -e "${GREEN}🎉 Workflow complete! All phases done.${NC}"
echo -e "${GREEN}📝 Check $PROGRESS_FILE for details${NC}"
