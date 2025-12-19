#!/bin/sh
set -eu

log() {
  echo "[initdb] $(date '+%Y-%m-%d %H:%M:%S') $*"
}

# Verificações mínimas de ambiente
: "${POSTGRES_USER:?POSTGRES_USER não definido}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD não definido}"

DB_LIST="${APP_DATABASES:-template,sou_influencer,gabaritte,emprezza,alertalink}"
DB_PASSWORD_DEFAULT="${APP_DB_DEFAULT_PASSWORD:-$POSTGRES_PASSWORD}"

# Aguarda o Postgres ficar pronto para receber conexões
for i in $(seq 1 30); do
  if pg_isready -U "$POSTGRES_USER" >/dev/null 2>&1; then
    break
  fi
  log "Aguardando Postgres iniciar... tentativa $i"
  sleep 2
done

if ! pg_isready -U "$POSTGRES_USER" >/dev/null 2>&1; then
  log "Postgres não ficou pronto a tempo"
  exit 1
fi

create_role() {
  local db="$1"
  local role="${db}_user"
  local pass="$DB_PASSWORD_DEFAULT"

  log "Criando role '$role' (se não existir)"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "postgres" -v role="$role" -v pass="$pass" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'role', :'pass')
WHERE NOT EXISTS (SELECT FROM pg_roles WHERE rolname = :'role')
\gexec
SQL
}

create_database() {
  local db="$1"
  log "Criando database '$db' (se não existir)"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "postgres" -v db="$db" <<'SQL'
SELECT format('CREATE DATABASE %I ENCODING ''UTF8'' LC_COLLATE ''C'' LC_CTYPE ''C'' TEMPLATE template0', :'db')
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'db')
\gexec
SQL

  local role="${db}_user"
  log "Ajustando permissões para '$role' em '$db'"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$db" <<SQL
ALTER SCHEMA public OWNER TO "$POSTGRES_USER";
GRANT ALL PRIVILEGES ON DATABASE "$db" TO "$role";
GRANT USAGE, CREATE ON SCHEMA public TO "$role";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "$role";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO "$role";
SQL
}

old_IFS="$IFS"
IFS=','
for db in $DB_LIST; do
  log "Configurando banco '$db'..."
  create_role "$db"
  create_database "$db"
  log "Banco '$db' pronto."
done
IFS="$old_IFS"

log "Inicialização concluída com sucesso."
