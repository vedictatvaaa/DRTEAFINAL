#!/usr/bin/env bash
#
# Dr Tea — single-file VPS installer.
#
# Drop this ONE file on a fresh Ubuntu/Debian VPS and run it. It will:
#   1.  Install Docker + Compose if missing
#   2.  Clone the Dr Tea repo into /opt/drtea/app
#   3.  Generate strong random secrets (DB password, session, admin)
#   4.  Write /opt/drtea/.env  (chmod 600, owned by root)
#   5.  Bring up the full stack — Postgres + Node API + Caddy (auto-HTTPS)
#   6.  Print your admin password and live URL
#
# Day-2 ops:
#     drtea update      → pull latest code, rebuild, restart
#     drtea logs        → tail all logs
#     drtea ps          → show running containers
#     drtea backup      → dump Postgres to /opt/drtea/backups/
#
# Usage:
#   curl -fsSL https://example.com/install.sh | sudo bash         # interactive
#   sudo REPO_URL=... DOMAIN=... EMAIL=... bash install.sh        # unattended
#
set -euo pipefail

# ────────────────────────────────────────────────────────────────────────
# 0. Sanity checks
# ────────────────────────────────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
  echo "✘ Run as root:  sudo bash $0" >&2
  exit 1
fi

if ! command -v apt-get >/dev/null 2>&1; then
  echo "✘ This installer targets Debian/Ubuntu. apt-get not found." >&2
  exit 1
fi

# ────────────────────────────────────────────────────────────────────────
# 1. Collect config (env vars override prompts; sane defaults provided)
# ────────────────────────────────────────────────────────────────────────
prompt() {                                  # prompt VAR "Question" "default"
  local _var=$1 _q=$2 _def=${3:-}
  local _val=${!_var:-}
  if [[ -z "$_val" ]]; then
    if [[ -t 0 ]]; then
      read -r -p "  $_q${_def:+ [$_def]}: " _val
    fi
    _val=${_val:-$_def}
  fi
  printf -v "$_var" '%s' "$_val"
}

echo
echo "================================================================="
echo "   Dr Tea — VPS installer"
echo "================================================================="
echo

prompt DOMAIN   "Domain (e.g. drtea.in)"
prompt EMAIL    "Email for Let's Encrypt notifications"
prompt REPO_URL "Git repo URL" "https://github.com/vedictatvaaa/DRTEAFINAL.git"
prompt REPO_REF "Git branch / tag" "main"

# Multi-site VPS mode: skip our Caddy and expose the API on a chosen host port
# so another reverse proxy on the box (Caddy/nginx/Traefik) can route to it.
# Default: false (we own ports 80/443).
prompt SHARED_PROXY "Share this VPS with other sites? (true/false)" "false"
prompt HTTP_PORT    "Host HTTP port  (only used if SHARED_PROXY=false)" "80"
prompt HTTPS_PORT   "Host HTTPS port (only used if SHARED_PROXY=false)" "443"
prompt APP_PORT     "Host port to expose API on (only used if SHARED_PROXY=true)" "8080"

[[ -z "$DOMAIN"   ]] && { echo "✘ DOMAIN is required" >&2; exit 1; }
[[ -z "$EMAIL"    ]] && { echo "✘ EMAIL is required"  >&2; exit 1; }
[[ -z "$REPO_URL" ]] && { echo "✘ REPO_URL is required" >&2; exit 1; }

INSTALL_DIR=/opt/drtea
APP_DIR=$INSTALL_DIR/app
ENV_FILE=$INSTALL_DIR/.env
COMPOSE_FILE=$APP_DIR/deploy/standalone/docker-compose.yml

echo
echo "  Domain        : $DOMAIN"
echo "  ACME e-mail   : $EMAIL"
echo "  Repository    : $REPO_URL ($REPO_REF)"
echo "  Install path  : $INSTALL_DIR"
if [[ "$SHARED_PROXY" == "true" ]]; then
  echo "  Mode          : SHARED_PROXY (no built-in Caddy)"
  echo "  Exposed port  : $APP_PORT  (route your host proxy → 127.0.0.1:$APP_PORT)"
else
  echo "  Mode          : standalone (built-in Caddy + auto-TLS)"
  echo "  Host ports    : $HTTP_PORT (HTTP) / $HTTPS_PORT (HTTPS)"
fi
echo

# ────────────────────────────────────────────────────────────────────────
# 1b. Pre-flight port collision check — abort BEFORE installing anything
# ────────────────────────────────────────────────────────────────────────
# Skip our own existing containers (re-run / update on same box is fine).
port_owner() {                # port_owner 80  → echoes the process name or "-"
  local p=$1
  ss -ltnp 2>/dev/null | awk -v p=":${p}\$" '$4 ~ p {print $0; exit}' | \
    sed -n 's/.*users:(("\([^"]*\)".*/\1/p' | head -n1
}
port_in_use_by_other() {      # port_in_use_by_other 80  → 0=blocked, 1=free or ours
  local p=$1
  ss -ltn 2>/dev/null | awk -v p=":${p}\$" '$4 ~ p {found=1} END {exit !found}' || return 1
  # Port is bound — is it our own Caddy container?
  if docker ps --format '{{.Names}} {{.Ports}}' 2>/dev/null \
       | grep -E "^drtea[-_]caddy" | grep -q ":${p}->"; then
    return 1   # ours, OK to reuse
  fi
  return 0     # someone else owns it
}

if [[ "$SHARED_PROXY" == "true" ]]; then
  CHECK_PORTS=("$APP_PORT")
else
  CHECK_PORTS=("$HTTP_PORT" "$HTTPS_PORT")
fi

clash=0
for p in "${CHECK_PORTS[@]}"; do
  if port_in_use_by_other "$p"; then
    owner=$(port_owner "$p")
    echo "✘ Port $p is already in use by: ${owner:-unknown process}"
    clash=1
  fi
done
if [[ $clash -eq 1 ]]; then
  cat >&2 <<HINT

  Another service on this VPS is holding the port(s) above.
  Options:
    • Stop the other service:        sudo systemctl stop nginx  (or apache2, caddy, …)
    • Run Dr Tea behind it instead:  re-run with  SHARED_PROXY=true APP_PORT=8081
      then point that proxy at  http://127.0.0.1:8081
    • Pick non-standard ports:       HTTP_PORT=8080 HTTPS_PORT=8443 (TLS won't work
                                     on non-443 without an upstream proxy)

HINT
  exit 1
fi
echo "  ✓ ports free: ${CHECK_PORTS[*]}"
echo

# ────────────────────────────────────────────────────────────────────────
# 2. Install Docker (if missing)
# ────────────────────────────────────────────────────────────────────────
echo "==> [1/5] Installing system prerequisites"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y >/dev/null
apt-get install -y --no-install-recommends \
  ca-certificates curl git openssl gnupg ufw iproute2 >/dev/null

if ! command -v docker >/dev/null 2>&1; then
  echo "==> Installing Docker Engine"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/$(. /etc/os-release; echo "$ID")/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
https://download.docker.com/linux/$ID $VERSION_CODENAME stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y >/dev/null
  apt-get install -y docker-ce docker-ce-cli containerd.io \
    docker-buildx-plugin docker-compose-plugin >/dev/null
  systemctl enable --now docker >/dev/null
fi
echo "    docker: $(docker --version)"

# ────────────────────────────────────────────────────────────────────────
# 3. Open firewall ports (only if ufw is active)
# ────────────────────────────────────────────────────────────────────────
if ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow 22/tcp  >/dev/null || true
  if [[ "$SHARED_PROXY" == "true" ]]; then
    echo "==> SHARED_PROXY: leaving 80/443 alone (your host proxy owns them)"
    # APP_PORT stays bound to 127.0.0.1 inside docker — no ufw rule needed.
  else
    echo "==> Allowing $HTTP_PORT/$HTTPS_PORT through ufw"
    ufw allow "${HTTP_PORT}/tcp"  >/dev/null || true
    ufw allow "${HTTPS_PORT}/tcp" >/dev/null || true
  fi
fi

# ────────────────────────────────────────────────────────────────────────
# 4. Clone / update the application repo
# ────────────────────────────────────────────────────────────────────────
echo "==> [2/5] Fetching application source"
mkdir -p "$INSTALL_DIR"
if [[ -d "$APP_DIR/.git" ]]; then
  git -C "$APP_DIR" fetch --all --prune
  git -C "$APP_DIR" reset --hard "origin/$REPO_REF"
else
  git clone --branch "$REPO_REF" --depth 1 "$REPO_URL" "$APP_DIR"
fi

if [[ ! -f "$COMPOSE_FILE" ]]; then
  echo "✘ Expected $COMPOSE_FILE — repo missing deploy/standalone/. Pull latest." >&2
  exit 1
fi

# ────────────────────────────────────────────────────────────────────────
# 5. Generate / preserve secrets (write .env once, chmod 600)
# ────────────────────────────────────────────────────────────────────────
echo "==> [3/5] Writing $ENV_FILE"
if [[ ! -f "$ENV_FILE" ]]; then
  gen() { openssl rand -hex 32; }
  install -m 600 /dev/null "$ENV_FILE"
  cat > "$ENV_FILE" <<EOF
# Generated by deploy/install.sh on $(date -u +%Y-%m-%dT%H:%M:%SZ)
# Edit and re-run \`drtea update\` to apply.

DOMAIN=$DOMAIN
ACME_EMAIL=$EMAIL

# Deployment mode (set by installer; safe to edit + re-run \`drtea update\`)
SHARED_PROXY=$SHARED_PROXY
HTTP_PORT=$HTTP_PORT
HTTPS_PORT=$HTTPS_PORT
APP_PORT=$APP_PORT

POSTGRES_USER=drtea
POSTGRES_PASSWORD=$(gen)
POSTGRES_DB=drtea

SESSION_SECRET=$(openssl rand -hex 48)
ADMIN_PASSWORD=$(gen)
EOF
else
  echo "    (already exists — keeping existing secrets; backfilling new vars only)"
  for kv in "SHARED_PROXY=$SHARED_PROXY" "HTTP_PORT=$HTTP_PORT" \
            "HTTPS_PORT=$HTTPS_PORT" "APP_PORT=$APP_PORT"; do
    k=${kv%%=*}
    grep -q "^${k}=" "$ENV_FILE" || echo "$kv" >> "$ENV_FILE"
  done
fi

# ────────────────────────────────────────────────────────────────────────
# 6. Helper CLI:  drtea {up|update|logs|ps|backup|down}
# ────────────────────────────────────────────────────────────────────────
echo "==> [4/5] Installing 'drtea' helper CLI"
cat > /usr/local/bin/drtea <<'CLI'
#!/usr/bin/env bash
set -euo pipefail
cd /opt/drtea/app
APP_DIR=/opt/drtea/app
STATE_DIR=/opt/drtea/state
mkdir -p "$STATE_DIR"
SHARED_PROXY=$(grep '^SHARED_PROXY=' /opt/drtea/.env | cut -d= -f2- || echo false)
APP_PORT=$(grep '^APP_PORT=' /opt/drtea/.env | cut -d= -f2- || echo 8080)
if [[ "$SHARED_PROXY" == "true" ]]; then
  PROFILE_ARGS="--profile shared"
else
  PROFILE_ARGS="--profile standalone"
fi
DC="docker compose --env-file /opt/drtea/.env $PROFILE_ARGS -f deploy/standalone/docker-compose.yml"

health_check() {
  # Polls the API health endpoint until 200/ok or timeout. Returns 0/1.
  # In SHARED_PROXY mode we hit 127.0.0.1:APP_PORT directly (no TLS yet).
  local url
  if [[ "$SHARED_PROXY" == "true" ]]; then
    url="http://127.0.0.1:${APP_PORT}/api/healthz"
  else
    local domain
    domain=$(grep '^DOMAIN=' /opt/drtea/.env | cut -d= -f2-)
    url="https://${domain}/api/healthz"
  fi
  local tries=${1:-30}    # 30 × 5s = 150s
  echo "    health-check: $url"
  for i in $(seq 1 "$tries"); do
    if curl -fsS --max-time 5 "$url" | grep -q '"status":"ok"'; then
      echo "    ✓ healthy after ${i} attempt(s)"
      return 0
    fi
    sleep 5
  done
  echo "    ✘ health-check FAILED after $((tries*5))s"
  return 1
}

cmd=${1:-help}; shift || true

case "$cmd" in
  up)
    $DC up -d --build
    ;;

  update)
    # Optional flags:  --safe  (health-check + rollback)
    #                  --ref <sha-or-branch>  (deploy a specific revision)
    safe=false; ref=""
    while [[ $# -gt 0 ]]; do
      case "$1" in
        --safe) safe=true; shift ;;
        --ref)  ref="$2"; shift 2 ;;
        *)      shift ;;
      esac
    done

    prev_sha=$(git -C "$APP_DIR" rev-parse HEAD)
    branch=$(git -C "$APP_DIR" rev-parse --abbrev-ref HEAD)
    target=${ref:-origin/$branch}

    echo "==> Previous commit: $prev_sha"
    echo "==> Fetching"
    git -C "$APP_DIR" fetch --all --prune --tags
    echo "==> Checking out $target"
    git -C "$APP_DIR" reset --hard "$target"
    new_sha=$(git -C "$APP_DIR" rev-parse HEAD)
    echo "==> New commit: $new_sha"

    echo "==> Building"
    $DC build
    echo "==> Restarting"
    $DC up -d
    $DC ps

    if [[ "$safe" == "true" ]]; then
      if health_check 30; then
        echo "$prev_sha" > "$STATE_DIR/last-good-sha"
        echo "✓ Deploy succeeded — saved $prev_sha as rollback target"
        exit 0
      fi

      echo "✘ Deploy failed health-check — ROLLING BACK to $prev_sha"
      git -C "$APP_DIR" reset --hard "$prev_sha"
      $DC build
      $DC up -d
      if health_check 24; then
        echo "↩  Rollback healthy. Investigate failure before retrying."
      else
        echo "🔥 Rollback ALSO failed health-check — manual intervention required!"
      fi
      exit 1
    fi
    ;;

  rollback)
    target=${1:-}
    if [[ -z "$target" ]]; then
      target=$(cat "$STATE_DIR/last-good-sha" 2>/dev/null || true)
    fi
    if [[ -z "$target" ]]; then
      echo "✘ No rollback target. Pass a SHA: drtea rollback <sha>" >&2
      exit 1
    fi
    echo "==> Rolling back to $target"
    git -C "$APP_DIR" fetch --all --prune --tags
    git -C "$APP_DIR" reset --hard "$target"
    $DC build
    $DC up -d
    health_check 24 || { echo "✘ Rollback failed health-check"; exit 1; }
    ;;

  down)   $DC down ;;
  ps)     $DC ps ;;
  logs)   $DC logs -f --tail=200 "$@" ;;
  exec)   $DC exec "$@" ;;
  health) health_check 1 ;;

  backup)
    ts=$(date +%Y%m%d-%H%M%S)
    mkdir -p /opt/drtea/backups
    $DC exec -T postgres pg_dump -U drtea drtea | gzip > "/opt/drtea/backups/drtea-$ts.sql.gz"
    echo "Wrote /opt/drtea/backups/drtea-$ts.sql.gz"
    ;;

  *)
    cat <<HELP
drtea — Dr Tea VPS control

  drtea up                          Build + start the stack
  drtea update                      Pull latest, rebuild, restart (no rollback)
  drtea update --safe               Pull, restart, health-check, auto-rollback on failure
  drtea update --safe --ref <sha>   Deploy a specific commit safely
  drtea rollback [sha]              Force rollback (defaults to last-good-sha)
  drtea down                        Stop the stack
  drtea ps                          Show container status
  drtea logs [svc]                  Tail logs (optionally one service)
  drtea exec svc cmd                Run a command in a container
  drtea health                      One-shot health check
  drtea backup                      Snapshot Postgres → /opt/drtea/backups/
HELP
    ;;
esac
CLI
chmod +x /usr/local/bin/drtea

# ────────────────────────────────────────────────────────────────────────
# 7. First build + boot
# ────────────────────────────────────────────────────────────────────────
echo "==> [5/5] Building and starting the stack — this can take 5-10 minutes"
drtea up

# ────────────────────────────────────────────────────────────────────────
# 8. Final report
# ────────────────────────────────────────────────────────────────────────
ADMIN_PW=$(grep '^ADMIN_PASSWORD=' "$ENV_FILE" | cut -d= -f2-)
echo
echo "================================================================="
echo "  ✓  Dr Tea is starting at  https://$DOMAIN"
echo "================================================================="
echo
echo "  Admin URL      : https://$DOMAIN/admin"
echo "  Admin password : $ADMIN_PW"
echo
echo "  Caddy will fetch a Let's Encrypt cert on first request"
echo "  (make sure $DOMAIN and www.$DOMAIN already resolve to this VPS)."
echo
echo "  Day-2 ops:"
echo "    drtea logs       # follow logs"
echo "    drtea update     # pull + rebuild + restart"
echo "    drtea backup     # database snapshot"
echo
echo "  Secrets live in $ENV_FILE (root, 0600). Back it up."
echo
