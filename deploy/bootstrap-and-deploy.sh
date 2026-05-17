#!/usr/bin/env bash
# One-paste end-to-end installer for a fresh Hostinger Ubuntu VPS.
#
# Run as root, ONE LINE:
#   curl -fsSL https://raw.githubusercontent.com/<YOU>/<REPO>/main/deploy/bootstrap-and-deploy.sh \
#     | sudo REPO_URL=https://github.com/<YOU>/<REPO>.git DOMAIN=drtea.in EMAIL=hello@drtea.in bash
#
# Or, if you've already cloned the repo to /tmp:
#   sudo REPO_URL=https://github.com/<YOU>/<REPO>.git \
#        DOMAIN=drtea.in EMAIL=hello@drtea.in \
#        bash deploy/bootstrap-and-deploy.sh
#
# What it does (idempotent — safe to re-run):
#   1. Runs deploy/setup.sh (Node, pnpm, PM2, Postgres, Nginx, Certbot, app user)
#   2. Generates strong random secrets and writes /var/www/drtea-app/.env
#   3. Clones (or updates) the repo into /var/www/drtea-app
#   4. Runs the first deploy (build + drizzle push + PM2 start)
#   5. Installs the Nginx vhost and obtains a Let's Encrypt cert
#   6. Configures PM2 to start on reboot
#
# After this finishes, day-2 deploys are a single command:
#   sudo -u drtea -H bash /var/www/drtea-app/deploy/deploy.sh
# (or push to main and let GitHub Actions do it — see .github/workflows/deploy.yml)

set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "Run as root: sudo bash $0" >&2
  exit 1
fi

REPO_URL=${REPO_URL:?Set REPO_URL=https://github.com/you/your-repo.git}
DOMAIN=${DOMAIN:-drtea.in}
EMAIL=${EMAIL:?Set EMAIL=you@example.com (used for Lets Encrypt notifications)}
APP_USER=drtea
APP_DIR=/var/www/drtea-app
WEB_DIR=/var/www/drtea
ENV_FILE=${APP_DIR}/.env

echo
echo "================================================================="
echo "  Dr Tea hands-off installer"
echo "  Domain:  ${DOMAIN}"
echo "  Repo:    ${REPO_URL}"
echo "================================================================="
echo

# ---- Step 1: get the repo onto the box so we can run setup.sh ----
apt-get update -y && apt-get install -y git curl ca-certificates

if [[ ! -d "${APP_DIR}/.git" ]]; then
  echo "==> Cloning ${REPO_URL} -> ${APP_DIR}"
  rm -rf "${APP_DIR}"
  git clone "${REPO_URL}" "${APP_DIR}"
else
  echo "==> Updating existing checkout in ${APP_DIR}"
  git -C "${APP_DIR}" fetch --all --prune
  git -C "${APP_DIR}" reset --hard origin/$(git -C "${APP_DIR}" rev-parse --abbrev-ref HEAD)
fi

# ---- Step 2: base bootstrap (Node, pnpm, Postgres, Nginx, etc.) ----
echo "==> Running deploy/setup.sh"
DOMAIN="${DOMAIN}" bash "${APP_DIR}/deploy/setup.sh"

# ---- Step 3: own the checkout ----
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"

# ---- Step 4: generate / preserve secrets ----
gen_secret() { openssl rand -hex 48; }

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "==> Generating ${ENV_FILE} with strong random secrets"
  DB_PASS=$(gen_secret | head -c 32)
  SESSION_SECRET=$(gen_secret)
  ADMIN_PASSWORD=$(gen_secret | head -c 32)

  sudo -u postgres psql -c "ALTER USER ${APP_USER} WITH PASSWORD '${DB_PASS}';" >/dev/null

  install -m 600 -o "${APP_USER}" -g "${APP_USER}" /dev/null "${ENV_FILE}"
  cat > "${ENV_FILE}" <<EOF
NODE_ENV=production
PORT=8080
DATABASE_URL=postgresql://${APP_USER}:${DB_PASS}@127.0.0.1:5432/${APP_USER}
SESSION_SECRET=${SESSION_SECRET}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
PUBLIC_STORE_BASE=https://${DOMAIN}
PUBLIC_API_BASE=https://${DOMAIN}
ADMIN_ALLOWED_ORIGINS=

# Optional — fill in later, then \`sudo -u drtea -H pm2 restart drtea-api --update-env\`
DEFAULT_OBJECT_STORAGE_BUCKET_ID=
PRIVATE_OBJECT_DIR=
PUBLIC_OBJECT_SEARCH_PATHS=
RESEND_API_KEY=
EMAIL_FROM=hello@${DOMAIN}
SHIPROCKET_EMAIL=
SHIPROCKET_PASSWORD=
SHIPROCKET_WEBHOOK_TOKEN=
SHIPROCKET_PICKUP_LOCATION=Primary
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
CASHFREE_APP_ID=
CASHFREE_SECRET_KEY=
PHONEPE_MERCHANT_ID=
PHONEPE_SALT_KEY=
AI_INTEGRATIONS_OPENAI_API_KEY=
AI_INTEGRATIONS_OPENAI_BASE_URL=
AI_INTEGRATIONS_GEMINI_API_KEY=
AI_INTEGRATIONS_GEMINI_BASE_URL=
PSI_API_KEY=
EOF
  chown "${APP_USER}:${APP_USER}" "${ENV_FILE}"
  chmod 600 "${ENV_FILE}"

  echo
  echo "  Generated admin password (save this somewhere safe!):"
  echo "  ADMIN_PASSWORD=${ADMIN_PASSWORD}"
  echo
else
  echo "==> ${ENV_FILE} already exists — leaving it alone"
fi

# ---- Step 5: first deploy ----
echo "==> Running first deploy"
sudo -u "${APP_USER}" -H bash "${APP_DIR}/deploy/deploy.sh"

# ---- Step 6: Nginx vhost ----
echo "==> Installing Nginx vhost for ${DOMAIN}"
NGINX_CONF=/etc/nginx/sites-available/${DOMAIN}
# Replace the hard-coded server_name in the template with the actual domain
sed "s/drtea\.in/${DOMAIN}/g" "${APP_DIR}/deploy/nginx/drtea.in.conf" > "${NGINX_CONF}"
ln -sf "${NGINX_CONF}" "/etc/nginx/sites-enabled/${DOMAIN}"
rm -f /etc/nginx/sites-enabled/default

# Temporarily disable the SSL server block so nginx -t passes BEFORE certbot runs
if [[ ! -f "/etc/letsencrypt/live/${DOMAIN}/fullchain.pem" ]]; then
  echo "==> No TLS cert yet — installing temporary HTTP-only vhost"
  cat > "${NGINX_CONF}" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN} www.${DOMAIN};
    root ${WEB_DIR};
    index index.html;
    location /.well-known/acme-challenge/ { root /var/www/letsencrypt; }
    location /api/      { proxy_pass http://127.0.0.1:8080; proxy_set_header Host \$host; proxy_set_header X-Forwarded-Proto \$scheme; }
    location /          { try_files \$uri \$uri/ /index.html; }
}
EOF
  nginx -t && systemctl reload nginx

  echo "==> Obtaining Lets Encrypt certificate"
  certbot --nginx -d "${DOMAIN}" -d "www.${DOMAIN}" --redirect -m "${EMAIL}" --agree-tos -n || {
    echo "Certbot failed — DNS may not have propagated yet. Run this later:"
    echo "  sudo certbot --nginx -d ${DOMAIN} -d www.${DOMAIN} --redirect -m ${EMAIL} --agree-tos -n"
  }

  # Now write the full vhost (with TLS) and reload
  sed "s/drtea\.in/${DOMAIN}/g" "${APP_DIR}/deploy/nginx/drtea.in.conf" > "${NGINX_CONF}"
fi

nginx -t && systemctl reload nginx

# ---- Step 7: PM2 on boot ----
echo "==> Configuring PM2 to start on boot"
sudo -u "${APP_USER}" -H pm2 save
env PATH="$PATH:/usr/bin" pm2 startup systemd -u "${APP_USER}" --hp "/home/${APP_USER}" >/dev/null

systemctl enable --now certbot.timer 2>/dev/null || true

echo
echo "================================================================="
echo "  Done.  Visit:  https://${DOMAIN}"
echo "  Admin login: https://${DOMAIN}/admin   (password is in ${ENV_FILE})"
echo
echo "  Day-2 deploys:"
echo "    sudo -u ${APP_USER} -H bash ${APP_DIR}/deploy/deploy.sh"
echo
echo "  Or push to main and let GitHub Actions do it"
echo "  (see .github/workflows/deploy.yml)."
echo "================================================================="
