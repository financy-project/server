# Dev Container Setup

This project includes a dev container configuration for consistent development environments.

## Requirements

- Docker Desktop (or Docker Engine + Docker Compose)
- VS Code with "Dev Containers" extension
- OR: Any editor/IDE that supports dev containers

## Quick Start

### VS Code

1. Install the "Dev Containers" extension
2. Open the project folder in VS Code
3. Press `Cmd/Ctrl + Shift + P` and run: **Dev Containers: Reopen in Container**
4. Wait for the container to build and dependencies to install

### Command Line

```bash
# Build and run the container
docker compose -f .devcontainer/docker-compose.yml up -d

# Access the container
docker exec -it financy-server-dev bash
```

## What's Included

- **Node.js 22** — matches `engines.node` in `package.json`
- **pnpm** — via corepack
- **TypeScript** — full type checking support
- **Git** + **GitHub CLI (`gh`)**
- **Python 3** — required by the `.claude/skills/commit` and `.claude/skills/write-test` scripts
- **Claude Code CLI** — pre-installed globally

## Available Commands

```bash
pnpm dev              # Start dev server (http://localhost:4000)
pnpm build            # Build TypeScript
pnpm test             # Run unit tests
pnpm test:integration # Run repository integration tests
pnpm test:e2e         # Run e2e (GraphQL operation) tests
pnpm format           # Format code with Prettier
```

## Database (Postgres)

This container only runs the `app` service — it does **not** include Postgres and has no access to the host's Docker daemon (no Docker-in/outside-of-Docker wired up here). `pnpm dev`'s automatic `predev` step (`docker compose -f docker-compose.dev.yml up -d --wait`, see [docs/architecture/09-configuration.md](../docs/architecture/09-configuration.md)) therefore **cannot** start Postgres from inside this container.

Start it from the host instead, before or alongside the dev container:

```bash
# On the host, not inside the container
pnpm docker:dev
```

If the container can't reach `localhost:5532` for the host's Postgres (common on native Linux Docker Engine — Docker Desktop resolves this automatically), point `DATABASE_URL` at `host.docker.internal` instead of `localhost` for this container's session.

## Port Forwarding

- **4000** — GraphQL API dev server (auto-forwarded to host)

## SSH & Git Config

SSH keys, `.gitconfig`, `.git-credentials`, and `~/.claude` are mounted from your host machine so Git, GitHub, and Claude Code work the same as outside the container.

## Troubleshooting

**Container won't start?**

```bash
docker system prune -a  # Clean up old images
```

**Dependencies not installing?**

```bash
# Rebuild without cache
docker build --no-cache -f .devcontainer/Dockerfile -t financy-server-dev .
```

**Need to reset everything?**

```bash
docker compose -f .devcontainer/docker-compose.yml down -v
```
