FROM node:24-bookworm-slim

WORKDIR /app

# Prisma needs openssl present at runtime.
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm install

COPY . .

# Build the pristine, byte-identical dataset ONCE, baked into the image.
ENV DATABASE_URL="file:/app/prisma/pristine.db"
RUN npx prisma generate \
 && npx prisma db push --skip-generate \
 && npx tsx src/generate.ts

# Runtime uses a disposable working copy that the entrypoint seeds from pristine.
ENV DATABASE_URL="file:/app/data/app.db"
ENV PORT=3000
EXPOSE 3000

RUN chmod +x docker-entrypoint.sh
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["npx", "tsx", "src/server.ts"]
