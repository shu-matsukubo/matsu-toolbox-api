# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim AS development

WORKDIR /app

COPY package.json package-lock.json ./
RUN --mount=type=secret,id=npm_ca,required=false \
    if [ -f /run/secrets/npm_ca ]; then \
      NODE_EXTRA_CA_CERTS=/run/secrets/npm_ca npm ci; \
    else \
      npm ci; \
    fi

COPY . .

EXPOSE 8080

CMD ["npm", "run", "dev"]
