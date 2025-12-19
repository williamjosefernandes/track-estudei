---

[![Swagger UI](https://img.shields.io/badge/Swagger-85EA2D?style=for-the-badge&logo=Swagger&logoColor=white)](http://localhost:3000/swagger)

---

## Gestão de Branches

Fluxo utilizado: **Git Flow**

![git-flow](https://i.imgur.com/Wk7LfaW.png)

---

# Tutoriais

## Executar a sincronização de planetas/artefatos localmente

**_Atenção: Apontar as connection strings para o ambiente local_**

1. Excluir a pasta dist

2. Parar e remover todos os containers
```
docker container stop $(docker container list -qa) && docker container rm $(docker container list -qa)
```

3. Parar todos os containers e limpar os dados do Docker
```
docker system prune -a -f && docker system prune --volumes -f
```

4. Atualizar os pacotes da aplicação
```
npm install
```

5. Subir os container auxiliares à aplicação
```
docker-compose up -d
```

6. Executar as migrations
```
npm run migrations
```

7. Executar a aplicação
```
npm run start:dev
```

8. Executar a request de sincronização de planetas
```
  curl -X 'POST' \
    'http://localhost:3000/planet-sync/sync-all' \
    -H 'accept: application/json' \
    -d ''
```

9. Verificar status da sincronização de planetas
```
  curl -X 'GET' \
    'http://localhost:3000/planet-sync/sync-status' \
    -H 'accept: */*'
 
---

# APIs Principais

## Autenticação (`/auth`)

- `POST /auth` — Login (body: `{ email, password, checkme }`) → `{ user, accessToken, expiresIn }`
- `POST /auth/reset-password` — Solicitar recuperação de senha (body: `{ email }`) → `{ success: true }`
- `POST /auth/check-code-reset-password` — Validar token de recuperação (body: `{ token }`) → `{ success }`
- `POST /auth/change-password` — Alterar senha com token (body: `{ token, password, passwordConfirmation }`) → `{ user, accessToken }`
- `POST /auth/send-confirm-email` — Enviar confirmação de email (body: `{ email }`) → `{ success }`
- `POST /auth/confirm-email` — Confirmar email (body: `{ emailToken }`) → `{ success }`
- `POST /auth/logout` — Logout (Bearer token) → `{ message }`
- `GET /auth/validate` — Validar token JWT (Bearer token)

## Planos de Estudo (`/study-plan`)

- `GET /study-plan?page=<n>&limit=<n>&title=<t>&status=<s>&category=<c>` — Lista paginada
- `GET /study-plan/overview` — Visão geral (totais por status)
- `GET /study-plan/:id` — Detalhe
- `POST /study-plan` — Criar
- `PATCH /study-plan/:id` — Atualizar parcialmente
- `PUT /study-plan/:id` — Atualizar
- `DELETE /study-plan/:id` — Remover

Demais módulos: `subjects`, `trails`, `trail-content`, `history`, `statistics`, `cronograma` seguem organização por controller e service em `src/`.
```
