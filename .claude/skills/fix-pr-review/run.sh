#!/bin/bash
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

if [ $# -lt 1 ]; then
  echo -e "${RED}❌ Usage: /fix-pr-review <PR_NUMBER> [\"review description/comments\"]${NC}"
  exit 1
fi

PR_NUMBER=$1
REVIEW_DESC=$2
ORIGINAL_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# 1. Verify gh CLI is installed
if ! command -v gh &> /dev/null; then
  echo -e "${RED}❌ GitHub CLI (gh) is not installed or not in PATH.${NC}"
  exit 1
fi

# 2. Fetch PR details
echo -e "${BLUE}🔍 Fetching PR #$PR_NUMBER information...${NC}"
PR_INFO=$(gh pr view "$PR_NUMBER" --json headRefName,baseRefName,url,title --jq '{branch: .headRefName, base: .baseRefName, url: .url, title: .title}' 2>/dev/null || true)

if [ -z "$PR_INFO" ]; then
  echo -e "${RED}❌ Could not fetch PR #$PR_NUMBER. Check if the PR number is correct and if you have access.${NC}"
  exit 1
fi

PR_BRANCH=$(echo "$PR_INFO" | jq -r '.branch')
BASE_BRANCH=$(echo "$PR_INFO" | jq -r '.base')
PR_URL=$(echo "$PR_INFO" | jq -r '.url')
PR_TITLE=$(echo "$PR_INFO" | jq -r '.title')

echo -e "${GREEN}✅ PR #$PR_NUMBER found:${NC}"
echo -e "   Title:  $PR_TITLE"
echo -e "   Branch: $PR_BRANCH"
echo -e "   Base:   $BASE_BRANCH"
echo -e "   URL:    $PR_URL"
echo ""

# 3. Check for uncommitted changes & stash
STASHED=0
if [ -n "$(git status --short)" ]; then
  echo -e "${YELLOW}📦 Stashing current uncommitted changes...${NC}"
  STASH_MSG="fix-pr-review-backup-$(date +%s)"
  git stash push -m "$STASH_MSG"
  STASHED=1
fi

# 4. Checkout PR branch
echo -e "${BLUE}🔀 Checking out PR branch: $PR_BRANCH${NC}"
git checkout "$PR_BRANCH"

# If no review description is provided, we just prepare the branch and exit
if [ -z "$REVIEW_DESC" ]; then
  echo ""
  echo -e "${GREEN}✨ Branch is ready for manual fixes!${NC}"
  echo -e "Current Branch: $(git rev-parse --abbrev-ref HEAD)"
  echo -e "Base Branch:    $BASE_BRANCH"
  echo ""
  echo "Next steps:"
  echo "1. Apply review fixes to the code."
  echo "2. Test your changes: pnpm test"
  echo "3. Commit: python .claude/skills/commit/commit.py (or git commit -m 'fix(review): describe your fixes')"
  echo "4. Rebase: git rebase $BASE_BRANCH"
  echo "5. Push:   git push origin $PR_BRANCH --force-with-lease"
  echo ""
  echo "To return to your original branch and restore stashed work:"
  if [ $STASHED -eq 1 ]; then
    echo "   git checkout $ORIGINAL_BRANCH && git stash pop"
  else
    echo "   git checkout $ORIGINAL_BRANCH"
  fi
  exit 0
fi

# 5. Autonomous mode: spawn Claude to fix issues
echo -e "${BLUE}🤖 Spawning Claude to apply fixes autonomously...${NC}"
echo -e "Instructions: $REVIEW_DESC"
echo ""

AGENT_FILE=".claude/agents/backend-engineer.md"

# Detect test and build commands
TEST_CMD="npm test"
BUILD_CMD="npm run build"
if [ -f "pnpm-lock.yaml" ]; then
  TEST_CMD="pnpm test"
  BUILD_CMD="pnpm build"
elif [ -f "yarn.lock" ]; then
  TEST_CMD="yarn test"
  BUILD_CMD="yarn build"
fi

FIX_PROMPT=$(cat <<EOF
You are fixing code review comments for PR #$PR_NUMBER.

## PR Context
- Title: $PR_TITLE
- Branch: $PR_BRANCH
- Base Branch: $BASE_BRANCH
- Description of fixes needed: $REVIEW_DESC

## Instructions
For each requested fix:
1. Modify the code to address the feedback, following constitution.md and docs/architecture/.
2. Run tests to confirm it works: \`$TEST_CMD\`
3. Verify the project builds: \`$BUILD_CMD\`
4. Commit the changes using a semantic commit message. Use the /commit skill if available, or write a clean commit message.

When ALL fixes are complete, reply with "✅ FIX COMPLETE".
EOF
)

TEMP_SETTINGS=$(mktemp)
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
SYSTEM_PROMPT_ARG=""
if [ -f "$AGENT_FILE" ]; then
  SYSTEM_PROMPT_ARG="--append-system-prompt $(cat "$AGENT_FILE")"
fi

echo "$FIX_PROMPT" | claude \
  --dangerously-skip-permissions \
  --settings "$TEMP_SETTINGS" \
  --print \
  $SYSTEM_PROMPT_ARG \
  --append-system-prompt "AUTONOMOUS MODE: Fix the requested issues. Test your work. Commit when complete. Reply with ✅ FIX COMPLETE when done." \
  || {
    echo -e "${RED}❌ Claude failed to apply fixes. Returning to original branch.${NC}"
    rm -f "$TEMP_SETTINGS"
    git checkout "$ORIGINAL_BRANCH"
    [ $STASHED -eq 1 ] && git stash pop || true
    exit 1
  }

rm -f "$TEMP_SETTINGS"
unset CLAUDE_SKIP_PERMISSIONS

# 6. Rebase and push
echo -e "${BLUE}🔄 Rebasing branch onto $BASE_BRANCH...${NC}"
git rebase "$BASE_BRANCH" || {
  echo -e "${RED}❌ Rebase conflict detected. Please resolve conflicts manually, then run:${NC}"
  echo "   git rebase --continue"
  echo "   git push origin $PR_BRANCH --force-with-lease"
  echo "   git checkout $ORIGINAL_BRANCH"
  [ $STASHED -eq 1 ] && echo "   git stash pop" || true
  exit 1
}

echo -e "${BLUE}📤 Force pushing changes with lease...${NC}"
git push origin "$PR_BRANCH" --force-with-lease

# 7. Restore original state
echo -e "${BLUE}📌 Returning to original branch: $ORIGINAL_BRANCH${NC}"
git checkout "$ORIGINAL_BRANCH"

if [ $STASHED -eq 1 ]; then
  echo -e "${BLUE}📦 Restoring stashed changes...${NC}"
  git stash pop || echo -e "${YELLOW}⚠️ Could not pop stash automatically. Retrieve using: git stash pop${NC}"
fi

echo -e "${GREEN}🎉 PR review fixes successfully applied and pushed!${NC}"
