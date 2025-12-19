#!/bin/sh
set -e

# Se DATABASE_URL estiver definido, escreve um arquivo .env dentro do container
if [ -n "$DATABASE_URL" ]; then
  echo "DATABASE_URL=\"$DATABASE_URL\"" > /usr/src/app/.env
  echo ".env criado com DATABASE_URL"
fi

# Executa o comando padrão
exec "$@"

