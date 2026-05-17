# Deploying Dr Tea to a Hostinger VPS

End-to-end instructions to take this monorepo from a fresh Hostinger VPS
to **https://drtea.in** in about 30 minutes. Everything you need is in
the `deploy/` folder.

---

## 1. What you'll have running

```
                         drtea.in (443)
                              │
                            Nginx
              ┌───────────────┴────────────────┐
              │                                │
     /  /assets  /images               /api  /sitemap*  /feeds
   (static SPA from                  (reverse proxy to
    /var/www/drtea)                   127.0.0.1:8080)
                                         │
                                     PM2 → Node 20
                                  artifacts/api-server
                                         │
                                  PostgreSQL 16 (local)
```

* **Frontend** — `artifacts/dr-tea` is built by Vite into static files and
  served directly by Nginx.
* **Backend** — `artifacts/api-server` runs as a single Node process
  managed by PM2 on `127.0.0.1:8080`. Nginx proxies `/api/*`,
  `/sitemap*.xml`, `/robots.txt`, and `/feeds/*` to it.
* **Database** — PostgreSQL 16 installed locally on the VPS. Schema is
  managed with Drizzle (`pnpm --filter @workspace/db run push`).

---

## 2. Hostinger VPS prerequisites

1. Order a Hostinger **VPS / Cloud Hosting** plan (KVM 2 or higher
   recommended; minimum 2 GB RAM, 2 vCPU, 40 GB disk).
2. Choose **Ubuntu 22.04 (or 24.04) LTS** when provisioning.
3. In hPanel → VPS → **Networking**, copy the public IPv4 address.
4. In your DNS provider (Hostinger DNS or wherever drtea.in is
   registered), create:
    * `A   drtea.in       → <VPS_IP>`
    * `A   www.drtea.in   → <VPS_IP>`
   Wait for propagation (`dig drtea.in +short`).
5. SSH in:
   ```bash
   ssh root@<VPS_IP>
   ```

---

## 3. Hands-off install (recommended)

Push this repo to GitHub (private is fine), then SSH to the VPS as root
and run **one** command:

```bash
curl -fsSL https://raw.githubusercontent.com/<YOU>/<REPO>/main/deploy/bootstrap-and-deploy.sh \
  | sudo REPO_URL=https://github.com/<YOU>/<REPO>.git \
         DOMAIN=drtea.in \
         EMAIL=hello@drtea.in \
         bash
```

This single command installs Node 20, pnpm, PostgreSQL 16, Nginx,
Certbot, and PM2; creates the `drtea` user; clones the repo; generates
strong random secrets; writes `/var/www/drtea-app/.env`; runs the first
build + database push; installs the Nginx vhost; obtains a Let's
Encrypt certificate; and configures PM2 to start on reboot.

When it finishes, it prints the auto-generated admin password — save
it. Then visit **https://drtea.in**.

If you'd rather do it manually, sections 3a–8 below show the same steps
broken out.

### 3a. Manual one-shot bootstrap

```bash
# On the VPS, as root:
apt-get install -y git
git clone <YOUR_GIT_REPO_URL> /tmp/drtea-bootstrap
sudo bash /tmp/drtea-bootstrap/deploy/setup.sh
```

When it finishes it prints the next steps — they're also below.

---

## 4. Database password

```bash
sudo -u postgres psql -c "ALTER USER drtea WITH PASSWORD 'PICK_A_STRONG_ONE';"
```

---

## 5. Place the code on the VPS

```bash
sudo -u drtea -H git clone <YOUR_GIT_REPO_URL> /var/www/drtea-app
sudo cp /var/www/drtea-app/deploy/.env.production.example /var/www/drtea-app/.env
sudo chown drtea:drtea /var/www/drtea-app/.env
sudo -e /var/www/drtea-app/.env   # fill in real values, save and exit
```

Required values:
* `DATABASE_URL` — `postgresql://drtea:<password>@127.0.0.1:5432/drtea`
* `SESSION_SECRET` — `openssl rand -hex 48`
* `ADMIN_PASSWORD` — long random string for `/admin`
* `PUBLIC_STORE_BASE` — `https://drtea.in`
* `PUBLIC_API_BASE` — `https://drtea.in`

Optional but recommended:
* `RESEND_API_KEY` + `EMAIL_FROM` for transactional emails
* `SHIPROCKET_*` for order fulfilment
* `RAZORPAY_*` (or Stripe / Cashfree / PhonePe) for live payments
* `VAPID_*` for browser push notifications (`npx web-push generate-vapid-keys`)

---

## 6. First deploy

```bash
sudo -u drtea -H bash /var/www/drtea-app/deploy/deploy.sh
```

This script:
1. Pulls the latest from your branch
2. `pnpm install --frozen-lockfile`
3. `pnpm run build` (typecheck + builds every artifact)
4. `pnpm --filter @workspace/db run push` (applies schema)
5. Rsyncs the built storefront → `/var/www/drtea`
6. PM2 reload (zero-downtime)

You'll see a final health check line. If it errors, run
`pm2 logs drtea-api` to see why.

---

## 7. Nginx + HTTPS

```bash
sudo cp /var/www/drtea-app/deploy/nginx/drtea.in.conf /etc/nginx/sites-available/drtea.in
sudo ln -sf /etc/nginx/sites-available/drtea.in /etc/nginx/sites-enabled/drtea.in
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# Issue Let's Encrypt cert + auto-renew
sudo certbot --nginx -d drtea.in -d www.drtea.in --redirect -m hello@drtea.in --agree-tos -n
sudo systemctl enable --now certbot.timer
```

Visit https://drtea.in — you should see the storefront served over HTTPS.

---

## 8. Boot PM2 on reboot

```bash
sudo -u drtea -H pm2 startup systemd -u drtea --hp /home/drtea
# Copy/paste the `sudo env PATH=... pm2 startup` command it prints, then:
sudo -u drtea -H pm2 save
```

(If you'd rather use systemd, there's a unit file at
`deploy/systemd/drtea-api.service` you can enable instead — see the
comment block in that file. Don't run both PM2 and systemd for the same
process.)

---

## 9. Continuous deploy via GitHub Actions (zero SSH after setup)

A workflow at `.github/workflows/deploy.yml` redeploys on every push to
`main`. To enable it:

1. Generate a deploy key locally:
   ```bash
   ssh-keygen -t ed25519 -f drtea_deploy -N "" -C "github-actions"
   ```
2. On the VPS, allow that key to log in as the `drtea` user:
   ```bash
   sudo -u drtea -H mkdir -p /home/drtea/.ssh
   sudo -u drtea -H chmod 700 /home/drtea/.ssh
   cat drtea_deploy.pub | sudo -u drtea -H tee -a /home/drtea/.ssh/authorized_keys
   sudo -u drtea -H chmod 600 /home/drtea/.ssh/authorized_keys
   ```
3. In GitHub → repo → **Settings → Secrets and variables → Actions**, add:
   * `VPS_HOST` = `drtea.in`
   * `VPS_USER` = `drtea`
   * `VPS_SSH_KEY` = the contents of the **private** `drtea_deploy` file
   * `VPS_PORT` = `22` (only if you use a non-standard SSH port)
4. Push to `main`. The workflow installs deps, typechecks, then SSHes in
   and runs `deploy/deploy.sh`. A smoke test hits `/api/health`.

After this, you never need to SSH into the box for routine releases.

---

## 10. Day-2 operations

| Task | Command |
| ---- | ------- |
| Deploy a new release | `sudo -u drtea -H bash /var/www/drtea-app/deploy/deploy.sh` |
| Tail API logs | `sudo -u drtea -H pm2 logs drtea-api` |
| Restart API | `sudo -u drtea -H pm2 restart drtea-api` |
| Reload Nginx after config changes | `sudo nginx -t && sudo systemctl reload nginx` |
| Renew TLS now (auto-runs daily) | `sudo certbot renew && sudo systemctl reload nginx` |
| Database shell | `sudo -u postgres psql drtea` |
| Backup DB to file | `sudo -u postgres pg_dump -Fc drtea > /var/backups/drtea-$(date +%F).dump` |
| Restore DB from file | `sudo -u postgres pg_restore -d drtea --clean /var/backups/drtea-YYYY-MM-DD.dump` |
| Disk / memory check | `df -h && free -h && pm2 status` |

---

## 11. Hardening checklist

* [ ] SSH key-only login (`PasswordAuthentication no` in `/etc/ssh/sshd_config`).
* [ ] `ufw status` shows only `OpenSSH` and `Nginx Full` open.
* [ ] `.env` permissions: `chmod 600 /var/www/drtea-app/.env`.
* [ ] Postgres only listens on `127.0.0.1` (default; do not change `listen_addresses`).
* [ ] Daily DB backup cron (e.g. `pg_dump` to `/var/backups/` + offsite copy).
* [ ] Hostinger snapshot/backup enabled in hPanel.
* [ ] `unattended-upgrades` enabled for security patches:
      `sudo apt-get install unattended-upgrades && sudo dpkg-reconfigure -plow unattended-upgrades`.

---

## 12. Troubleshooting

**Nginx returns 502 Bad Gateway**  
The API isn't running on `127.0.0.1:8080`. Run `pm2 status` and
`pm2 logs drtea-api`. Common causes: missing `DATABASE_URL`, wrong
`SESSION_SECRET`, or a build failure that left no `dist/index.mjs`.

**`pnpm run build` fails with TypeScript errors**  
Run `pnpm run typecheck` to see the full list. Fix locally, push,
re-deploy.

**The storefront loads but `/api/...` calls fail with CORS errors**  
You're likely serving the SPA from a different origin than the API.
Either move them to the same origin (the default Nginx config does
this) or add the storefront origin to `ADMIN_ALLOWED_ORIGINS` in `.env`
and reload PM2.

**`certbot --nginx` cannot reach the domain**  
DNS hasn't propagated yet, or port 80 is blocked. Check
`dig drtea.in +short` returns your VPS IP, and `ufw status` shows
`Nginx Full` allowed.

**Image uploads break with `ENOSPC` or 500 errors**  
Object storage isn't configured. Either fill in the
`DEFAULT_OBJECT_STORAGE_BUCKET_ID` / `PRIVATE_OBJECT_DIR` /
`PUBLIC_OBJECT_SEARCH_PATHS` env vars (Replit App Storage), or swap
those routes to a local-disk implementation.
