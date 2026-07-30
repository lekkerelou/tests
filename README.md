# Northstar Admin

Panel d’administration construit avec [vinext](https://github.com/cloudflare/vinext),
[Kumo UI](https://kumo-ui.com/) et Tailwind CSS 4. Le build vinext produit un
serveur Node.js autonome dans `dist/standalone`.

## Développement

```bash
pnpm install
pnpm dev
```

Ouvrez ensuite <http://localhost:3000>.

## Vérifier et construire

```bash
pnpm check
pnpm build
pnpm start
```

Le endpoint `GET /api/health` est utilisé par le healthcheck du conteneur.

## Docker

L’image finale utilise Node.js 24 distroless et s’exécute avec l’utilisateur
non privilégié `65532`. Elle ne contient ni shell, ni gestionnaire de paquets,
ni sources du projet.

```bash
docker build --tag northstar-admin .
docker run --rm --read-only \
  --user 65532:65532 \
  --cap-drop ALL \
  --security-opt no-new-privileges \
  --tmpfs /tmp:rw,noexec,nosuid,size=16m \
  --pids-limit 128 \
  --memory 512m \
  --cpus 1 \
  --publish 3000:3000 \
  northstar-admin
```

Le profil restrictif est également fourni avec Compose :

```bash
docker compose up --build
```

Pour lancer directement l’image publiée :

```bash
IMAGE=ghcr.io/lekkerelou/tests:latest docker compose up
```

## CI/CD et GHCR

La workflow [`.github/workflows/container.yml`](.github/workflows/container.yml) :

- construit et vérifie l’image sur chaque pull request ;
- publie les architectures `linux/amd64` et `linux/arm64` sur les pushes vers
  `main`, les tags `v*` et les lancements manuels ;
- génère les tags `latest`, branche, Git SHA et version Git ;
- publie un SBOM et des attestations de provenance ;
- utilise uniquement le `GITHUB_TOKEN` fourni par GitHub.

Image publiée :

```text
ghcr.io/lekkerelou/tests
```

Pour rendre une première image publique, ajustez sa visibilité dans les
paramètres du package GitHub après sa publication.
