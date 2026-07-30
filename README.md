# Claude Control

Dark administration console built with
[vinext](https://github.com/cloudflare/vinext) and
[Kumo UI](https://kumo-ui.com/). The interface exclusively uses Kumo
components for controls, forms, tables, dialogs, and states.

The console covers features available through an Anthropic Admin key:

- organization information;
- members, roles, and access removal;
- invitations;
- workspaces and archiving;
- API key inventory and deactivation;
- usage, costs, and Claude Code analytics;
- rate limits and spend limits;
- Compliance Activity Feed;
- advanced explorer restricted to an Admin API allowlist.

Features requiring an `org:admin` OAuth token, including service accounts and
Workload Identity Federation, are not exposed through Admin key authentication.

## Session security

The `sk-ant-admin…` key is validated with `GET /v1/organizations/me`, encrypted
with AES-GCM, and stored for eight hours in an `HttpOnly`, `SameSite=Strict`
cookie that is `Secure` in production. It is never returned to client-side code
or stored in `localStorage`.

Set an encryption secret that is independent from the Anthropic key:

```bash
cp .env.example .env.local
```

`ADMIN_SESSION_SECRET` must contain at least 32 characters. Generate one with:

```bash
openssl rand -hex 32
```

## Development

```bash
pnpm install
pnpm dev
```

Then open <http://localhost:3000>.

## Check and build

```bash
pnpm check
pnpm build
pnpm start
```

The container health check uses the `GET /api/health` endpoint.

## Docker

The final image uses Node.js 24 distroless and runs as the unprivileged user
`65532`. It contains no shell, package manager, or project source files.

```bash
export ADMIN_SESSION_SECRET="$(openssl rand -hex 32)"
docker build --tag northstar-admin .
docker run --rm --read-only \
  --user 65532:65532 \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  --env ADMIN_SESSION_SECRET \
  --tmpfs /tmp:rw,noexec,nosuid,size=16m \
  --pids-limit 128 \
  --memory 512m \
  --cpus 1 \
  --publish 3000:3000 \
  northstar-admin
```

The same restrictive profile is available through Compose:

```bash
export ADMIN_SESSION_SECRET="$(openssl rand -hex 32)"
docker compose up --build
```

To run the published image directly:

```bash
IMAGE=ghcr.io/lekkerelou/tests:latest docker compose up
```

## CI/CD and GHCR

The [`.github/workflows/container.yml`](.github/workflows/container.yml)
workflow:

- builds and validates the image on every pull request;
- publishes `linux/amd64` and `linux/arm64` images on pushes to `main`, `v*`
  tags, and manual runs;
- generates `latest`, branch, Git SHA, and Git version tags;
- publishes an SBOM and provenance attestations;
- only uses the `GITHUB_TOKEN` supplied by GitHub.

Published image:

```text
ghcr.io/lekkerelou/tests
```

After the first publication, adjust the package visibility in GitHub Packages
if the image should be public.
