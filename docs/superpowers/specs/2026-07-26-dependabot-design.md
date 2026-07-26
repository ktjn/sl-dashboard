# Add Dependabot configuration

## Problem

The repo has no automated dependency-update mechanism. `package.json`
dependencies (managed via pnpm) and the GitHub Actions used in
`.github/workflows/deploy.yml` (`actions/checkout`, `pnpm/action-setup`,
`actions/setup-node`, `JamesIves/github-pages-deploy-action`) all have to be
bumped manually.

## Goal

Add `.github/dependabot.yml` covering both ecosystems this repo uses.

## Design

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

- `package-ecosystem: "npm"` covers pnpm projects too (Dependabot detects
  the lockfile type — `pnpm-lock.yaml` here — automatically).
- `directory: "/"` for both, matching `package.json` and
  `.github/workflows/` both living at the repo root.
- Weekly schedule, minor/patch versions grouped into one PR per ecosystem
  per run to reduce noise; major version bumps are excluded from the group
  (Dependabot's default behavior when a `groups` block only lists specific
  `update-types`) so they still open their own individual PR for review.

## Non-goals

- No `open-pull-requests-limit` override (Dependabot's default of 5 is
  fine for this repo's size).
- No `ignore` rules for specific packages — nothing currently warrants
  being excluded from updates.

## Testing

Not applicable — this is a GitHub-native config file with no local build
step. Correctness is verified by GitHub validating the YAML on push (the
Dependabot tab in repo settings will show parse errors if any) and by the
first scheduled run actually opening PRs as configured.
