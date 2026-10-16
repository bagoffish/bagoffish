# FxEmbed integration for bagof.fish

The Worker build is configured to call the service **bag of fish** rather than FxTwitter and to redirect the embed card to `https://bagof.fish`.

## Routing

- `https://bagof.fish/<username>/status/<id>` is intended to be handled by FxEmbed.
- Other paths are intended to pass through to the existing GitHub Pages origin.
- `https://fossils.onrender.com` is not modified.

Cloudflare's route is `bagof.fish/*`; the dispatcher decides which paths should use FxEmbed and which should fall through to the website. Verify origin pass-through behavior before enabling the route on the live domain.

## GitHub Actions secrets

Required to deploy:
- `CF_ACCOUNT_ID` (or `R2_ACCOUNT_ID`)
- `CLOUDFLARE_API_TOKEN` with permission to deploy Workers and manage routes

Optional, for bundling logged-in X account credentials:
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `CREDENTIAL_KEY` matching the encrypted `credentials.enc.json` object

The workflow uses the R2 bucket `bagoffish-media`. If all optional credential secrets are present, it fetches the encrypted object and bundles it. If they're missing, the Worker can still deploy in credential-less mode, but X may apply stricter rate limits and some authenticated-only content may not work.

Do not commit `.env`, `credentials.json`, `credentials.enc.json`, or `.credential-key`.

Wait for the bagof.fish Cloudflare zone to become Active before deploying the Worker route.
