#!/bin/bash
set -e

if [ $# -eq 0 ]; then
  echo "Usage: feature-new 'Feature Name Here' [--milestone 'v1.0']"
  exit 1
fi

FEATURE_NAME="$1"
MILESTONE=""

# Parse optional --milestone flag
if [ $# -ge 3 ] && [ "$2" = "--milestone" ]; then
  MILESTONE="$3"
fi

FEATURE_SLUG=$(echo "$FEATURE_NAME" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/-\+/-/g' | sed 's/^-\|-$//')

# Find next number: prefer this repo's own GitHub issues if `gh` + a remote
# are available, otherwise fall back to scanning docs/features/ locally.
# Unlike the sibling REST project this workflow was adapted from, there is
# no separate centralized "features" repo here -- issues live in this repo.
echo "Checking this repository's issues for the next PM-NNN number..."
MAX_NUM=$(gh issue list --limit 100 --state all --json title --jq '.[].title' 2>/dev/null | grep -oE 'PM-[0-9]+' | cut -d'-' -f2 | sort -n | tail -n1 || echo "")

if [ -z "$MAX_NUM" ]; then
  echo "No GitHub issues found with PM-NNN (or gh/remote unavailable). Checking local directory..."
  NEXT_NUM=1
  while [ -d "docs/features/PM-$(printf '%03d' $NEXT_NUM)-"* ]; do
    NEXT_NUM=$((NEXT_NUM + 1))
  done
else
  # Convert to base 10 integer to avoid octal parsing issues (like 008)
  LAST_NUM=$((10#$MAX_NUM))
  NEXT_NUM=$((LAST_NUM + 1))
fi

FEATURE_ID="PM-$(printf '%03d' $NEXT_NUM)"
FEATURE_DIR="docs/features/$FEATURE_ID-$FEATURE_SLUG"

echo "Creating feature: $FEATURE_ID - $FEATURE_NAME"
echo "Directory: $FEATURE_DIR"

mkdir -p "$FEATURE_DIR"

# Copy plan template
sed "s/{{FEATURE_NAME}}/$FEATURE_NAME/g; s/{{NUMBER}}/$(printf '%03d' $NEXT_NUM)/g" docs/features/_templates/plan.md > "$FEATURE_DIR/plan.md"

echo "✓ Feature directory created"
echo ""
echo "=== Quick Feature Specification ==="
echo ""

# Prompt for feature details (fallback for non-interactive environments)
if [ -t 0 ]; then
  read -p "📝 Brief description (one sentence): " DESCRIPTION || true
  read -p "👥 Who are the main users? (e.g., 'end users, admins'): " USERS || true
  read -p "✅ Main acceptance criteria (comma-separated): " CRITERIA || true
fi

# Set defaults if empty (fixes silent read failures via AI tools)
DESCRIPTION=${DESCRIPTION:-"Feature implementation for $FEATURE_NAME"}
USERS=${USERS:-"To be defined"}
CRITERIA=${CRITERIA:-"To be defined"}

# Format acceptance criteria for spec and issue description
FORMATTED_CRITERIA=$(echo "$CRITERIA" | tr ',' '\n' | sed 's/^[[:space:]]*/* [ ] /')

# Generate spec.md with user input
cat > "$FEATURE_DIR/spec.md" << EOF
# $FEATURE_NAME - $FEATURE_ID

## Description

$DESCRIPTION

## Users

$USERS

## Acceptance Criteria

$FORMATTED_CRITERIA

## Out of Scope

- What should NOT be included in this feature.
EOF

echo "✓ Spec created with your details"

# GitHub issue creation arguments (targets THIS repository, no -R)
GH_ISSUE_ARGS=(
  "--title" "$FEATURE_ID: $FEATURE_NAME"
  "--body" "## Description
$DESCRIPTION

## Users
$USERS

## Acceptance Criteria
$FORMATTED_CRITERIA

---
## Files
- **Specification**: [$FEATURE_DIR/spec.md]($FEATURE_DIR/spec.md)
- **Plan**: [$FEATURE_DIR/plan.md]($FEATURE_DIR/plan.md)"
)

# Handle Milestone
if [ -n "$MILESTONE" ]; then
  echo "Checking/creating GitHub milestone: $MILESTONE"
  MILESTONE_ID=$(gh api repos/:owner/:repo/milestones --jq ".[] | select(.title == \"$MILESTONE\") | .number" 2>/dev/null || echo "")

  if [ -z "$MILESTONE_ID" ]; then
    MILESTONE_ID=$(gh api repos/:owner/:repo/milestones -f title="$MILESTONE" -f description="Milestone for $FEATURE_NAME" --jq '.number' 2>/dev/null || echo "")
  fi

  if [ -n "$MILESTONE_ID" ]; then
    echo "✓ Milestone: $MILESTONE (#$MILESTONE_ID)"
    GH_ISSUE_ARGS+=("--milestone" "$MILESTONE")
  else
    echo "⚠️ Milestone creation failed or gh/remote unavailable - skipping milestone association"
  fi
fi

# Attempt to create the GitHub issue in this repository (best-effort — a
# missing remote or unauthenticated gh should not block local feature setup)
echo "Creating GitHub issue: $FEATURE_ID: $FEATURE_NAME"

if ISSUE_URL=$(gh issue create "${GH_ISSUE_ARGS[@]}" 2>&1); then
  echo "✓ GitHub issue created: $ISSUE_URL"
else
  echo "⚠️ Issue creation skipped/failed (no remote, gh not authenticated, or no permissions). Continuing locally."
fi

# Create git branch
git checkout -b "$FEATURE_ID/$FEATURE_SLUG"
echo "✓ Git branch created: $FEATURE_ID/$FEATURE_SLUG"

# Push branch to remote (best-effort)
if git push -u origin "$FEATURE_ID/$FEATURE_SLUG" 2>/dev/null; then
  echo "✓ Branch pushed to remote"
else
  echo "⚠️ Could not push branch (no remote configured yet?). Continuing locally."
fi

echo ""
echo "Next steps:"
echo "1. Edit $FEATURE_DIR/spec.md"
echo "2. Run: /feature-plan"
echo "3. Run: /feature-task"
echo "4. Start implementing with /workflow!"
