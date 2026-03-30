#!/usr/bin/env bash
# ============================================================
# SkyNet — Deploy / Rollback Manager
# Usage:
#   ./deploy.sh deploy       — checkpoint + build + migrate + up
#   ./deploy.sh rollback     — interactive rollback to a checkpoint
#   ./deploy.sh checkpoint   — create a checkpoint only (no deploy)
#   ./deploy.sh list         — list all checkpoints
#   ./deploy.sh clean        — prune old checkpoints (keep last 5)
# ============================================================

set -euo pipefail

# ── Config ──────────────────────────────────────────────────
COMPOSE_FILE="docker-compose.yml"
DB_CONTAINER="skynet-db-1"
DB_USER="skynet"
DB_NAME="skynet"
BACKEND_IMAGE="skynet-backend"
FRONTEND_IMAGE="skynet-frontend"
CHECKPOINT_FILE=".docker_checkpoints"
BACKUP_DIR="backups"
LOG_FILE="CoAgentLOG.md"
HEALTH_URL="http://localhost:8000/api/v1/health"
KEEP_LAST=5

# ── Colors ──────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

info()    { echo -e "${CYAN}[INFO]${RESET}  $*"; }
success() { echo -e "${GREEN}[OK]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[WARN]${RESET}  $*"; }
error()   { echo -e "${RED}[ERROR]${RESET} $*" >&2; }
die()     { error "$*"; exit 1; }
log_action() { echo "[$(date '+%Y-%m-%d %H:%M')] $*" >> "${LOG_FILE}"; }

# ── Helpers ─────────────────────────────────────────────────
require_cmd() { command -v "$1" &>/dev/null || die "Required command not found: $1"; }
require_root() {
  [[ -f "${COMPOSE_FILE}" ]] || die "Run this script from the SkyNet repo root."
  mkdir -p "${BACKUP_DIR}"
  touch "${CHECKPOINT_FILE}"
}

image_exists() { docker image inspect "$1" &>/dev/null; }

# ── Checkpoint ──────────────────────────────────────────────
cmd_checkpoint() {
  require_root
  local ts
  ts=$(date +%Y%m%d_%H%M%S)
  local tag="checkpoint_${ts}"

  info "Creating checkpoint: ${tag}"

  # Tag current images
  if image_exists "${BACKEND_IMAGE}:latest"; then
    docker tag "${BACKEND_IMAGE}:latest" "${BACKEND_IMAGE}:${tag}"
    success "Tagged ${BACKEND_IMAGE}:${tag}"
  else
    warn "No ${BACKEND_IMAGE}:latest found — skipping image tag"
  fi

  if image_exists "${FRONTEND_IMAGE}:latest"; then
    docker tag "${FRONTEND_IMAGE}:latest" "${FRONTEND_IMAGE}:${tag}"
    success "Tagged ${FRONTEND_IMAGE}:${tag}"
  else
    warn "No ${FRONTEND_IMAGE}:latest found — skipping image tag"
  fi

  # DB dump
  if docker ps --format '{{.Names}}' | grep -q "^${DB_CONTAINER}$"; then
    local dump_file="${BACKUP_DIR}/db_${ts}.sql"
    info "Dumping database → ${dump_file}"
    docker exec "${DB_CONTAINER}" pg_dump -U "${DB_USER}" "${DB_NAME}" > "${dump_file}"
    success "DB dump saved: ${dump_file}"
  else
    warn "DB container '${DB_CONTAINER}' not running — skipping DB dump"
  fi

  # Record checkpoint
  echo "${tag}" >> "${CHECKPOINT_FILE}"
  log_action "CHECKPOINT: ${tag} created (images tagged + DB dump)"
  success "Checkpoint ${tag} ready"
  echo "${tag}"
}

# ── Deploy ──────────────────────────────────────────────────
cmd_deploy() {
  require_root
  echo -e "\n${BOLD}═══════════════════════════════════════${RESET}"
  echo -e "${BOLD}  SkyNet Production Deploy${RESET}"
  echo -e "${BOLD}═══════════════════════════════════════${RESET}\n"

  # Step 1 — Checkpoint
  info "Step 1/6 — Creating rollback checkpoint..."
  local tag
  tag=$(cmd_checkpoint)

  # Step 2 — Pull latest code
  local main_branch
  main_branch=$(git remote show origin 2>/dev/null | awk '/HEAD branch/ {print $NF}')
  main_branch=${main_branch:-master}
  info "Step 2/6 — Pulling latest code (${main_branch})..."
  git checkout "${main_branch}"
  git pull origin "${main_branch}"
  success "Code up to date"

  # Step 3 — Build (no cache)
  info "Step 3/6 — Building images (--no-cache)..."
  docker compose -f "${COMPOSE_FILE}" build --no-cache
  success "Images built"

  # Step 4 — DB migrations
  info "Step 4/6 — Applying DB migrations..."
  docker compose -f "${COMPOSE_FILE}" run --rm backend alembic upgrade head
  success "Migrations applied"

  # Step 5 — Restart containers
  info "Step 5/6 — Restarting containers..."
  docker compose -f "${COMPOSE_FILE}" up -d --remove-orphans
  success "Containers up"

  # Step 6 — Health check
  info "Step 6/6 — Health check (${HEALTH_URL})..."
  sleep 5
  local attempts=0
  until curl -sf "${HEALTH_URL}" &>/dev/null; do
    attempts=$((attempts + 1))
    if [[ ${attempts} -ge 6 ]]; then
      error "Health check failed after ${attempts} attempts."
      warn "Run:  ./deploy.sh rollback  to restore ${tag}"
      log_action "DEPLOY FAILED: health check failed — rollback available at ${tag}"
      exit 1
    fi
    warn "Not ready yet, retrying (${attempts}/6)..."
    sleep 5
  done

  success "Health check passed"
  docker compose -f "${COMPOSE_FILE}" ps

  log_action "DEPLOY SUCCESS: deployed from main — rollback checkpoint: ${tag}"
  echo -e "\n${GREEN}${BOLD}Deploy complete. Checkpoint: ${tag}${RESET}\n"
}

# ── Rollback ─────────────────────────────────────────────────
cmd_rollback() {
  require_root
  [[ -s "${CHECKPOINT_FILE}" ]] || die "No checkpoints found in ${CHECKPOINT_FILE}"

  echo -e "\n${BOLD}Available checkpoints:${RESET}"
  local i=1
  local -a checkpoints=()
  while IFS= read -r line; do
    [[ -z "${line}" ]] && continue
    checkpoints+=("${line}")
  done < "${CHECKPOINT_FILE}"

  # Show newest first
  local total=${#checkpoints[@]}
  for (( idx=total-1; idx>=0; idx-- )); do
    echo "  ${CYAN}[$((total-idx))]${RESET}  ${checkpoints[$idx]}"
  done

  echo ""
  read -rp "Select checkpoint number to restore [1]: " choice
  choice=${choice:-1}

  local selected_idx=$(( total - choice ))
  [[ ${selected_idx} -lt 0 || ${selected_idx} -ge ${total} ]] && die "Invalid selection"
  local target="${checkpoints[$selected_idx]}"
  local ts="${target#checkpoint_}"

  echo ""
  warn "You are about to roll back to: ${BOLD}${target}${RESET}"
  warn "This will restart containers and restore the DB dump."
  read -rp "Confirm? [y/N]: " confirm
  [[ "${confirm,,}" == "y" ]] || { info "Rollback cancelled."; exit 0; }

  # Restore images
  info "Restoring container images..."
  if image_exists "${BACKEND_IMAGE}:${target}"; then
    docker tag "${BACKEND_IMAGE}:${target}" "${BACKEND_IMAGE}:latest"
    success "Restored ${BACKEND_IMAGE}:latest from ${target}"
  else
    warn "Image ${BACKEND_IMAGE}:${target} not found — skipping"
  fi

  if image_exists "${FRONTEND_IMAGE}:${target}"; then
    docker tag "${FRONTEND_IMAGE}:${target}" "${FRONTEND_IMAGE}:latest"
    success "Restored ${FRONTEND_IMAGE}:latest from ${target}"
  else
    warn "Image ${FRONTEND_IMAGE}:${target} not found — skipping"
  fi

  # Restart containers with restored images
  info "Restarting containers..."
  docker compose -f "${COMPOSE_FILE}" down
  docker compose -f "${COMPOSE_FILE}" up -d --no-build

  # Restore DB
  local dump="${BACKUP_DIR}/db_${ts}.sql"
  if [[ -f "${dump}" ]]; then
    info "Restoring DB from ${dump}..."
    docker exec -i "${DB_CONTAINER}" psql -U "${DB_USER}" -d "${DB_NAME}" \
      -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" &>/dev/null
    docker exec -i "${DB_CONTAINER}" psql -U "${DB_USER}" "${DB_NAME}" < "${dump}"
    success "DB restored"
  else
    warn "DB dump ${dump} not found — DB not restored"
  fi

  # Health check
  sleep 5
  if curl -sf "${HEALTH_URL}" &>/dev/null; then
    success "Health check passed"
  else
    error "Health check failed after rollback — check logs: docker compose logs backend"
  fi

  docker compose -f "${COMPOSE_FILE}" ps
  log_action "ROLLBACK: restored to ${target}"
  echo -e "\n${GREEN}${BOLD}Rollback to ${target} complete.${RESET}\n"
}

# ── List ─────────────────────────────────────────────────────
cmd_list() {
  require_root
  [[ -s "${CHECKPOINT_FILE}" ]] || { info "No checkpoints yet."; exit 0; }

  echo -e "\n${BOLD}Checkpoints (newest first):${RESET}"
  local -a checkpoints=()
  while IFS= read -r line; do
    [[ -z "${line}" ]] && continue
    checkpoints+=("${line}")
  done < "${CHECKPOINT_FILE}"

  local total=${#checkpoints[@]}
  for (( idx=total-1; idx>=0; idx-- )); do
    local tag="${checkpoints[$idx]}"
    local ts="${tag#checkpoint_}"
    local dump="${BACKUP_DIR}/db_${ts}.sql"
    local db_status="no DB dump"
    [[ -f "${dump}" ]] && db_status="DB: $(du -sh "${dump}" | cut -f1)"
    echo -e "  ${CYAN}${tag}${RESET}  (${db_status})"
  done
  echo ""
}

# ── Clean ────────────────────────────────────────────────────
cmd_clean() {
  require_root
  info "Pruning checkpoints — keeping last ${KEEP_LAST}..."

  # Prune images
  for svc in "${BACKEND_IMAGE}" "${FRONTEND_IMAGE}"; do
    local old_images
    old_images=$(docker images --format '{{.Tag}} {{.ID}}' "${svc}" \
      | grep "^checkpoint_" | sort -r | tail -n +$((KEEP_LAST + 1)) | awk '{print $2}')
    if [[ -n "${old_images}" ]]; then
      echo "${old_images}" | xargs docker rmi -f
      success "Pruned old ${svc} checkpoint images"
    fi
  done

  # Prune DB dumps
  local old_dumps
  old_dumps=$(ls -t "${BACKUP_DIR}"/db_*.sql 2>/dev/null | tail -n +$((KEEP_LAST + 1)))
  if [[ -n "${old_dumps}" ]]; then
    echo "${old_dumps}" | xargs rm
    success "Pruned old DB dumps"
  fi

  # Trim checkpoint file to last N
  if [[ -s "${CHECKPOINT_FILE}" ]]; then
    tail -n "${KEEP_LAST}" "${CHECKPOINT_FILE}" > "${CHECKPOINT_FILE}.tmp"
    mv "${CHECKPOINT_FILE}.tmp" "${CHECKPOINT_FILE}"
  fi

  log_action "CLEAN: pruned old checkpoints, kept last ${KEEP_LAST}"
  success "Cleanup done"
}

# ── Entry point ──────────────────────────────────────────────
require_cmd docker
require_cmd git
require_cmd curl

case "${1:-help}" in
  deploy)     cmd_deploy ;;
  rollback)   cmd_rollback ;;
  checkpoint) cmd_checkpoint ;;
  list)       cmd_list ;;
  clean)      cmd_clean ;;
  *)
    echo -e "\n${BOLD}SkyNet Deploy Manager${RESET}"
    echo "Usage: $0 <command>"
    echo ""
    echo "  ${CYAN}deploy${RESET}      Create checkpoint, build, migrate, restart containers"
    echo "  ${CYAN}rollback${RESET}    Interactive rollback to a previous checkpoint"
    echo "  ${CYAN}checkpoint${RESET}  Snapshot current images + DB (no deploy)"
    echo "  ${CYAN}list${RESET}        List all available checkpoints"
    echo "  ${CYAN}clean${RESET}       Prune old checkpoints (keep last ${KEEP_LAST})"
    echo ""
    ;;
esac
