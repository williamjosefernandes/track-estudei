FROM node:20 AS build

WORKDIR /usr/src/app

ARG DATABASE_URL="postgresql://postgres:srcWGlzAymjKEIkdANEFrMQEMvAohtjB@postgres.railway.internal:5432/railway"
ENV DATABASE_URL=${DATABASE_URL}

COPY package.json ./

RUN npm i

COPY . .

# Gera o client do Prisma; DATABASE_URL está definido via ARG/ENV para evitar erro de validação durante build
RUN npx prisma generate || true

RUN npm run build

# Produção: imagem mais leve
FROM node:20-alpine AS production
WORKDIR /usr/src/app

ENV NODE_ENV=production

COPY --from=build /usr/src/app/package.json ./
COPY --from=build /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/dist ./dist
COPY --from=build /usr/src/app/prisma ./prisma

# Copia o entrypoint que cria .env com DATABASE_URL quando fornecido
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3001

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD [ "node", "--max-old-space-size=6144", "dist/src/main.js" ]
