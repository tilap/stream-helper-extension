---
name: create-pr
description: Create a GitHub Pull Request end-to-end (branch, commits, push, PR creation) using git and the GitHub CLI (gh). Use when the user asks to "create a PR", "open a PR", "make a pull request", "submit changes", or when preparing changes for review.
---

# Create a PR (GitHub)

## Quick checks

- Run `git status` to confirm this is a git repo and see the current state.
- If `git status` fails (not a git repo), stop and report that the current folder is not a repository. Suggest either running from the correct folder or initializing git (only if the user explicitly wants that).
- Run `git remote -v` and `git branch -vv` to confirm remotes and tracking branches.
- If `gh` is not available or not authenticated, run `gh auth status` and guide the user through authentication.

## Prepare the branch

- If currently on `main`/`master`, create a feature branch:
  - `git switch -c <short-descriptive-branch-name>`
- If already on a feature branch, keep it.
- Ensure the branch has an upstream once pushed: `git push -u origin HEAD`.

## Review and commit changes (only if requested)

- Never commit unless the user explicitly asked you to commit.
- When asked to commit:
  - Review `git diff` and `git status` to understand what will be committed.
  - Stage intentionally: `git add -A` (or specific files when appropriate).
  - Create a descriptive commit message focusing on intent.
  - Do not include secrets (e.g. `.env`, credentials files).

## Push and create the PR

- Push branch: `git push -u origin HEAD` (first push) or `git push` (subsequent pushes).
- Create the PR with `gh pr create` and a structured body:

```bash
gh pr create --title "<title>" --body "$(cat <<'EOF'
## Summary
- <what changed and why>

## Test plan
- [ ] <how you tested>

## Notes
- <anything reviewers should know>
EOF
)"
```

## Verify

- Always print the PR URL at the end so the user can open it directly.
- Prefer capturing the URL directly when creating the PR:

```bash
PR_URL="$(gh pr create --title "<title>" --body "$(cat <<'EOF'
## Summary
- <what changed and why>

## Test plan
- [ ] <how you tested>

## Notes
- <anything reviewers should know>
EOF
)" --json url -q .url)"
echo "$PR_URL"
```

- If the PR already exists (or creation output was lost), fetch and print the URL:

```bash
gh pr view --json url -q .url
```

- If checks fail, summarize failing checks and propose the next fix step (do not push force unless explicitly requested).

