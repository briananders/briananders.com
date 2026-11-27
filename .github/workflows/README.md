# GitHub Workflows

All workflows run on `ubuntu-latest` (Ubuntu 26.04 LTS), use Node 24-native action releases (`actions/checkout@v7`, `actions/setup-node@v7`, `actions/upload-artifact@v7`, `anthropics/claude-code-action@v1`), and read the project Node version from `.nvmrc` (`v26.13.1`).

## Workflows

| File | Trigger | Purpose |
|---|---|---|
| `build-validation.yml` | `pull_request` | Runs `npm run typecheck`, `npm run lint`, `npm run build` (plus committed AVIF verification), and `npm test` using `npm ci`. |
| `deploy-staging.yml` | Push to `staging`, `workflow_dispatch` | Builds and deploys to `staging.briananders.com` via `npm run stage`. Queued via native `concurrency` (`cancel-in-progress: false`). |
| `deploy-production.yml` | Push to `main`, `workflow_dispatch` | Builds, deploys to `www.briananders.com` via `npm run deploy`, invalidates CloudFront, and pushes a `deploy/<timestamp>` tag. Queued via native `concurrency` (`cancel-in-progress: false`). |
| `sync-staging.yml` | Push to `main` | Merges `origin/main` back into `staging` when non-`.github` files differ. |
| `claude-code-review.yml` | PR `opened`, `synchronize` | Runs automated PR review via `anthropics/claude-code-action@v1`. |
| `claude.yml` | `@claude` mentions on issues, PR comments, and reviews | Sets up Node + Chromium and runs `anthropics/claude-code-action@v1` with `typecheck`, `build`, `build:golden`, `test`, `lint`, and `screenshot` allowed; uploads `screenshots/` as an artifact. |

## Required Secrets

- `CLAUDE_CODE_OAUTH_TOKEN` — Used by `claude-code-review.yml` and `claude.yml`.
- `AWS_ACCESS_KEY`, `AWS_SECRET_ACCESS_KEY`, `CLOUDFRONT_ID` — Used by `deploy-staging.yml` and `deploy-production.yml`.

## Customizing Claude Workflows

Edit `.github/workflows/claude-code-review.yml` or `.github/workflows/claude.yml`:

- **Prompt**: Update the `prompt` input.
- **CLI flags (model, allowed tools, max turns)**: Pass them in `claude_args` (for example `--allowedTools "..."` or `--model ...`).

## Troubleshooting

- **Permission errors**: Verify each workflow's `permissions` block and repository Settings → Actions → General → Workflow permissions.
- **Claude workflow auth errors**: Confirm `CLAUDE_CODE_OAUTH_TOKEN` is valid under Settings → Secrets and variables → Actions.
- **Stale AVIF failure in `build-validation.yml`**: Run `npm run build` locally and commit the updated files in `src/images/` and `src/images/avif-manifest.json`.
