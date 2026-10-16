# FxEmbed integration for bagof.fish

FxEmbed is included here as a pinned Git submodule at `workers/fxembed`, so it stays under this repository's tree without forking the upstream project. The integration dispatcher is stored in this repository at `workers/fxembed-dispatcher.ts`.

## Routing

- `https://bagof.fish/<username>/status/<id>` is handled by FxEmbed.
- Other paths pass through to the existing GitHub Pages origin.
- `https://fossils.onrender.com` is not modified.

Cloudflare cannot route on an infix wildcard pattern such as `*/status/*`, so the Worker route covers `bagof.fish/*`; the dispatcher only invokes FxEmbed for status paths and forwards everything else to the origin.

## Actions secrets required

- `CF_ACCOUNT_ID` (or `R2_ACCOUNT_ID`)
- `CLOUDFLARE_API_TOKEN` with Workers Scripts and Routes deployment permissions
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `CREDENTIAL_KEY` matching the encrypted credential object in R2

The deploy workflow is set to use R2 bucket `bagoffish-media` and object `credentials.enc.json`. It creates the local .env and Wrangler configuration during CI; do not commit credentials or an .env file.

Wait for the bagof.fish Cloudflare zone to become Active before deploying the Worker route.
