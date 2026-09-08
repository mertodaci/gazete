FROM node:20-alpine AS base
WORKDIR /repo
COPY . .
RUN npm ci
RUN npm run prisma:generate --workspace=@gazete/db
RUN npm run build --workspace=apps/web

EXPOSE 3000
CMD ["npm", "run", "start", "--workspace=apps/web"]
