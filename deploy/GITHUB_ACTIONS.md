# Auto-deploy from GitHub with three failsafes

Every push to `main` runs `.github/workflows/deploy.yml`, which:

1. **Author allowlist** — only deploys commits pushed by names in the
   `ALLOWED_AUTHORS` secret. Anyone else → no deploy, opens a GitHub
   issue labelled `deploy-blocked` `security`.
2. **Sensitive-path guard** — if the commit touches any of
   `deploy/`, `Dockerfile`, `docker-compose.yml`, `Caddyfile`,
   `pnpm-lock.yaml`, `package.json`, `.env*`, or `.github/workflows/`,
   auto-deploy is refused and an issue is opened. You then manually
   trigger the workflow with the **force** input checked (or approve
   it in the `production` environment).
3. **Health-check + rollback** — on the VPS, `drtea update --safe`
   polls `https://<domain>/api/healthz` for up to 150 s; if it never
   returns `{"status":"ok"}`, the VPS resets to the previous commit,
   rebuilds, and reports failure. GitHub then opens a `deploy-failed`
   issue.

## One-time setup

### 1. SSH key for GitHub → VPS

On your laptop (not the VPS):
```bash
ssh-keygen -t ed25519 -f drtea-deploy -C "github-actions"
```
Copy the **public** key to the VPS:
```bash
ssh-copy-id -i drtea-deploy.pub root@drtea.in
```

### 2. GitHub repo secrets

Settings → Secrets and variables → Actions → **New repository secret**:

| Secret            | Value                                                      |
|-------------------|------------------------------------------------------------|
| `VPS_HOST`        | `drtea.in` (or the VPS IP)                                 |
| `VPS_USER`        | `root` (or a sudoer)                                       |
| `VPS_SSH_KEY`     | Contents of the **private** key file `drtea-deploy`        |
| `ALLOWED_AUTHORS` | `vedictatvaaa` (comma-separated for multiple collaborators)|

### 3. (Strongly recommended) Manual-approval environment

Settings → Environments → **New environment** → `production`
→ enable **Required reviewers** → add yourself.

Now **every** deploy waits for your click in the GitHub UI before
touching the VPS — even clean ones. Combined with the author + path
guards, an attacker would need: a write token AND your GitHub session
AND a clean diff. Defense in depth.

## Day-to-day flow

| You do                              | What happens                              |
|-------------------------------------|-------------------------------------------|
| Push to `main`                      | Guard → (approval) → deploy → health check|
| Clean diff, allowlisted author      | Auto-deploys in ~2 min                    |
| Touches `Dockerfile`/`deploy/`/etc. | Issue opened, no deploy                   |
| Push from unknown author            | Issue opened, no deploy                   |
| Deploy fails health-check           | VPS auto-rolls back, issue opened         |
| You want to force a risky deploy    | Actions tab → Run workflow → ✓ force      |

## Manual override on the VPS

If you ever need to act directly:

```bash
ssh root@drtea.in
drtea update --safe                # same flow as GitHub Action
drtea update --safe --ref <sha>    # deploy a specific commit
drtea rollback                     # back to the last good commit
drtea rollback <sha>               # back to a specific commit
drtea health                       # one-shot probe
drtea logs api-server              # tail logs
```
