# Dependabot configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `.github/dependabot.yml` covering both ecosystems this repo uses (npm/pnpm and GitHub Actions), weekly schedule, minor/patch grouped.

**Architecture:** Single static YAML config file — no code changes.

**Tech Stack:** GitHub Dependabot (native, no dependencies).

## Global Constraints

- `package-ecosystem: "npm"` (covers pnpm — spec: "Dependabot detects the lockfile type automatically") and `package-ecosystem: "github-actions"`, both `directory: "/"`.
- Weekly schedule, minor/patch grouped per ecosystem, majors excluded from the group (spec Design).
- No `open-pull-requests-limit` override, no `ignore` rules (spec Non-goals).

---

### Task 1: Add `.github/dependabot.yml`

**Files:**
- Create: `.github/dependabot.yml`

**Interfaces:**
- Consumes: nothing.
- Produces: nothing — single-task plan.

- [ ] **Step 1: Create the config file**

Create `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
    groups:
      minor-and-patch:
        update-types:
          - "minor"
          - "patch"

  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
    groups:
      minor-and-patch:
        update-types:
          - "minor"
          - "patch"
```

- [ ] **Step 2: Verify the YAML parses correctly**

Run: `python3 -c "import yaml, sys; yaml.safe_load(open('.github/dependabot.yml')); print('VALID')" 2>&1 || node -e "const fs=require('fs'); const c=fs.readFileSync('.github/dependabot.yml','utf8'); console.log(c.split('\n').length + ' lines — visually confirm indentation is consistent (2-space, no tabs) since no YAML parser is available in this environment')"`

Expected: `VALID` printed if a YAML parser is available; otherwise, visually confirm the file matches the exact indentation shown in Step 1 (2-space, consistent, no tabs).

- [ ] **Step 3: Commit**

```bash
git add .github/dependabot.yml
git commit -m "ci: add Dependabot configuration for npm and GitHub Actions"
```
