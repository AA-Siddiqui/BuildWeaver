# ---- Build stage ----
FROM node:20-alpine AS build

WORKDIR /app

# Enable pnpm
RUN corepack enable

# Copy the rest of the repo
COPY . .

# Install dependencies
RUN pnpm install

# Build
RUN pnpm build

# ---- Runtime stage ----
FROM node:20-alpine AS runtime

WORKDIR /app

RUN corepack enable

# Copy built app and node_modules from build stage
COPY --from=build /app /app

# Expose port if your API listens on one (change if needed)
EXPOSE 3000

# Environment variables are read automatically via process.env
# Pass them at runtime with `docker run -e KEY=value` or `--env-file`

CMD ["pnpm", "--filter", "@buildweaver/api", "start"]
