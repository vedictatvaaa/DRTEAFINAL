#!/usr/bin/env bash
# One-shot VPS bootstrap for the Dr Tea storefront on Hostinger Ubuntu 22.04+.
# Run as root:  sudo bash deploy/setup.sh
#
# Installs: Node 20 LTS, pnpm, PostgreSQL 16, Nginx, Certbot, PM2.
# Creates:  app user, database, directories, log rotation.
# Idempotent — safe to re-run.

set -euo pipefail

APP_USER=drtea
APP_DIR=/var/www/drtea-app
WEB_DIR=/var/www/drtea
LOG_DIR=/var/log/drtea
DOMAIN=${DOMAIN:-drtea.in}
DB_NAME=drtea
DB_USER=drtea

if [[ $EUID -ne 0 ]]; then
  echo "Run as root: sudo bash $0" >&2
  exit 1
fi

echo "==> Updating apt"
apt-get update -y
apt-get upgrade -y

echo "==> Base packages"
apt-get install -y curl ca-certificates gnupg lsb-release ufw rsync git build-essential

echo "==> Node.js 20 LTS"
if ! command -v node >/dev/null 2>&1 || ! node -v | grep -q '^v20'; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

echo "==> pnpm + PM2"
npm install -g pnpm@9 pm2

echo "==> PostgreSQL"
apt-get install -y postgresql postgresql-contrib
systemctl enable --now postgresql

# Create role + database if missing
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD 'CHANGE_ME_AFTER_SETUP';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || \
  sudo -u postgres createdb -O ${DB_USER} ${DB_NAME}

echo "==> Nginx + Certbot"
apt-get install -y nginx certbot python3-certbot-nginx
systemctl enable --now nginx

echo "==> App user + directories"
id -u "${APP_USER}" >/dev/null 2>&1 || useradd --system --create-home --shell /bin/bash "${APP_USER}"
install -d -o "${APP_USER}" -g "${APP_USER}" "${APP_DIR}" "${WEB_DIR}" "${LOG_DIR}"
install -d -o www-data -g www-data /var/www/letsencrypt

echo "==> Log rotation"
cat > /etc/logrotate.d/drtea <<'EOF'
/var/log/drtea/*.log {
    weekly
    rotate 8
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}
EOF

echo "==> Firewall"
ufw allow OpenSSH || true
ufw allow 'Nginx Full' || true
yes | ufw enable || true

echo "==> Done."
cat <<EOF

Next steps (as root unless noted):

  1. Change the Postgres password and update DATABASE_URL in your .env:
       sudo -u postgres psql -c "ALTER USER ${DB_USER} WITH PASSWORD 'YOUR_NEW_PASSWORD';"

  2. Clone the repo into ${APP_DIR} as the app user:
       sudo -u ${APP_USER} -H git clone <YOUR_GIT_REPO_URL> ${APP_DIR}
       sudo cp deploy/.env.production.example ${APP_DIR}/.env
       sudo chown ${APP_USER}:${APP_USER} ${APP_DIR}/.env
       sudo -e ${APP_DIR}/.env             # fill in real values

  3. First-time deploy:
       sudo -u ${APP_USER} -H bash ${APP_DIR}/deploy/deploy.sh

  4. Wire up Nginx + TLS:
       sudo cp ${APP_DIR}/deploy/nginx/drtea.in.conf /etc/nginx/sites-available/${DOMAIN}
       sudo ln -sf /etc/nginx/sites-available/${DOMAIN} /etc/nginx/sites-enabled/${DOMAIN}
       sudo nginx -t && sudo systemctl reload nginx
       sudo certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}

  5. Boot PM2 on reboot (run the command it prints):
       sudo -u ${APP_USER} -H pm2 startup systemd -u ${APP_USER} --hp /home/${APP_USER}
       sudo -u ${APP_USER} -H pm2 save

EOF
