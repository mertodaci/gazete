FROM node:20-alpine AS base
WORKDIR /repo
RUN apk add --no-cache openssl
COPY . .
RUN npm ci
RUN npm run prisma:generate --workspace=@gazete/db

CMD ["npm", "run", "start", "--workspace=@gazete/worker"]
