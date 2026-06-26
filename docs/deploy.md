# Deploy

Runbook for deploying saasflare starter to Cloudflare via alchemy.

## Can this be auto-run?

Mostly. An agent (or you with a script) can drive every step **except A2**,
which needs three human-provided secrets:

| Step | Auto-runnable? | Why / why not |
|---|---|---|
| A1 preflight | ✅ | scripted checks |
| A1.5 set `PROJECT_NAME` | ❌ first deploy only | needs a human-chosen, account-unique name; skip when redeploying |
| A2 fill `.alchemy.env` | ❌ | CF token **must** be minted via `pnpm dlx alchemy util create-cloudflare-token` (interactive browser OAuth). The dashboard "Edit Cloudflare Workers" template lacks D1, R2 Data, and other scopes alchemy needs — using it will fail at the first D1/R2 resource. Agent cannot drive the OAuth flow, so the user runs the helper and pastes the token back. |
| A3 per-app `.env` | ❌ if domains/R2 desired | needs human choices |
| A4 sync secrets | ✅ | `pnpm sync:secrets` |
| A5 push | ✅ | `git push` |
| A6 verify | ✅ | curl + jq |
| A7 PR preview | ✅ | happens automatically on PR |
| A8 promote prod | ✅ except typed confirmation | requires literal `deploy prod` for safety |

So an agent should pause at A1.5 (first deploy only) / A2 / A3 / A8 to
collect input, then drive the rest end-to-end. Pause points are marked inline with
**🛑 AGENT PAUSE** blocks — ask the questions in those blocks using the
user's language and plain words (no jargon), then continue.

## Mental model

- **Two Workers**: `server` (Hono backend, port 4000 locally) and `web`
  (TanStack Start frontend, port 3000 locally), each provisioned by its
  own `apps/{server,web}/alchemy.run.ts`.
- **Stages** (`app.stage`):
  - `local` — `pnpm dev` (alchemy dev). Local state in `.alchemy/`.
  - `dev` — auto-deploys on push to `dev` branch.
  - `prod` — auto-deploys on push to `main`.
  - `pr-<N>` — auto-created on PR open, destroyed on PR close. Always uses
    `*.workers.dev` URLs (custom domain env vars are ignored for pr-*).
- **Split env**: control plane (`.alchemy.env` at root, shared by all
  stages and both apps) + per-app/per-stage extras
  (`apps/{server,web}/.{stage}.env`). The root-level `pnpm run deploy:*`
  scripts wrap deploys with `scripts/deploy.sh`, which auto-sources
  `.alchemy.env` so child alchemy processes inherit the control-plane
  env. Per-app `--env-file .{stage}.env` adds domain + R2 keys on top.
- **State store**: alchemy uses `CloudflareStateStore` (remote KV) when
  `CLOUDFLARE_API_TOKEN` is in the env (it always is, since
  `.alchemy.env` is sourced).

## Env files

| File | Scope | Contents | Synced to GitHub as |
|---|---|---|---|
| `.alchemy.env` | root, all stages, both apps | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_EMAIL`, `ALCHEMY_STATE_TOKEN` | `ENV_ALCHEMY` |
| `apps/server/.local.env` | server, local stage | R2 keys for local testing | — (local-only) |
| `apps/web/.local.env`    | web, local stage    | future `NEXT_PUBLIC_*` for local | — (local-only) |
| `apps/server/.dev.env`   | server, dev + every `pr-<N>` | `WEB_DOMAIN`, `SERVER_DOMAIN`, R2 keys | `ENV_SERVER_DEV` |
| `apps/web/.dev.env`      | web, dev + every `pr-<N>`    | `WEB_DOMAIN`, `SERVER_DOMAIN`, `NEXT_PUBLIC_*` | `ENV_WEB_DEV` |
| `apps/server/.prod.env`  | server, prod | same as dev | `ENV_SERVER_PROD` |
| `apps/web/.prod.env`     | web, prod    | same as dev | `ENV_WEB_PROD` |

All files are gitignored. Examples: `.alchemy.env.example`,
`apps/{server,web}/.local.env.example`.

## Deploy flows

| Path | When | What runs the deploy |
|---|---|---|
| **A. CI-first** | Fresh clone, normal day-to-day | GitHub Actions on push |
| **B. Local** | Debugging deploy issues | Your machine |

**Default to Path A** — CI always has the right env, no state divergence.

---

## Path A — CI-first

### A1. Preflight

```bash
node -v              # >= 23.6 (project parses .ts directly via Node)
pnpm -v              # >= 9
gh auth status       # else: gh auth login
gh repo set-default  # else `gh secret set` fails
test -d node_modules || pnpm install
```

### A1.5. First deploy only — set a unique `PROJECT_NAME`

Both apps ship with `const PROJECT_NAME = 'starter'` hard-coded in their
alchemy files. This value is the prefix for **every** provisioned resource
(`${PROJECT_NAME}-{kind}-${stage}` → Workers, KV, D1, R2). It must be
unique across the Cloudflare account — if it collides with another
project's resources, `adopt: true` will try to claim them (see the
`adopt: true` note under [Common issues](#common-issues)).

On the **first deploy of a new product** based on the starter, change
`PROJECT_NAME` in **both** files to the same new, account-unique name:

- `apps/web/alchemy.run.ts`
- `apps/server/alchemy.run.ts`

The two values **must match** — `web` resolves the server's URL (and vice
versa) from `${PROJECT_NAME}-...`, so a mismatch breaks cross-app wiring.
This is a one-time edit; skip it if you're redeploying an existing
project (or genuinely deploying the starter itself as `starter`).

> **🛑 AGENT PAUSE — pick the name with the user:** Ask: *"What short,
> lowercase name should this project use on Cloudflare? It prefixes every
> resource and must not already exist on your Cloudflare account (it
> currently says `starter`)."* Then set the same value in both
> `alchemy.run.ts` files.

### A2. Create `.alchemy.env`

```bash
cp .alchemy.env.example .alchemy.env
# fill in the three values:
#   CLOUDFLARE_API_TOKEN — see "Getting the CF token" below
#   CLOUDFLARE_EMAIL     — your CF account email
#   ALCHEMY_STATE_TOKEN  — openssl rand -hex 32 (or reuse from another
#                          saasflare project on this CF account — MUST match)
```

> **🛑 AGENT PAUSE — the CF token step is interactive (browser OAuth), so
> the agent cannot run it. Tell the user to do it themselves, then collect
> the three values:**
>
> 1. **CF token.** Say: *"The Cloudflare token step needs a browser login,
>    so I can't run it for you. Please run this in your terminal:*
>
>    ```bash
>    pnpm dlx alchemy util create-cloudflare-token
>    ```
>
>    *It opens a browser, you log in, and it prints a token. Paste the
>    token back here."*
>
>    **Do not** offer the dashboard "Edit Cloudflare Workers" template as
>    a fallback — it omits D1, Workers R2 Data, and other scopes alchemy
>    needs, and the deploy will fail at the first D1/R2 resource with
>    `401 Authentication error`. The helper mints a token with the full
>    scope set; insist on it.
>    Wait for the token before continuing.
> 2. **CF email.** Ask: *"What email is your Cloudflare account under?"*
> 3. **State token.** Ask: *"Is this your first saasflare project on this
>    Cloudflare account? If you have other saasflare projects on the same
>    account, paste their `ALCHEMY_STATE_TOKEN` here — it must match. If
>    this is the first one, just say 'first' and I'll generate one for
>    you with `openssl rand -hex 32`."*
>
> Then write all three into `.alchemy.env` and move on.

#### Getting the CF token

**Always use the alchemy helper.** Do not mint the token from the
dashboard — see the warning below.

```bash
pnpm dlx alchemy util create-cloudflare-token
```

Interactive OAuth: opens a browser, you log in, it prints a token. The
helper requests the full scope set alchemy needs (Workers Scripts, KV,
**D1**, R2, **Workers R2 Data**, Account Settings, DNS, Workers Routes,
User Details, Memberships).

If you have **multiple CF accounts** logged into alchemy, use the
`--profile` flag to pick one. A profile needs two steps: `configure`
creates it and picks the auth method, `login` then runs the OAuth flow.
Skipping `configure` gives `cloudflare is not configured on profile
"<name>"`.

```bash
# One-time per account
pnpm dlx alchemy configure -p saasflare  # creates profile, pick "Cloudflare" → "OAuth"
pnpm dlx alchemy login -p saasflare      # opens browser, log into the right CF account

pnpm dlx alchemy configure -p personal   # repeat for any other account
pnpm dlx alchemy login -p personal

# Then mint the token from the chosen profile
pnpm dlx alchemy util create-cloudflare-token -p saasflare
```

Profiles are stored under `~/.config/.alchemy/credentials/<profile>/`.
`pnpm dlx alchemy whoami -p <profile>` shows who's logged in there.

> **Why not the dashboard "Edit Cloudflare Workers" template?** It looks
> close but omits D1, Workers R2 Data, and a few other scopes alchemy
> uses. KV creation will succeed, then the deploy fails on the first D1
> binding with `CloudflareApiError: 401 Authentication error`. The
> helper is the only supported path.

> **Note**: profile selection only matters for the **token generation**
> step. Once the token is in `.alchemy.env`, deploys read
> `CLOUDFLARE_API_TOKEN` from env directly and don't touch profile
> credentials — so you never need to pass `--profile` to `deploy:*`.

### A3. (Optional) Create per-app `.{stage}.env` files

Only if you need custom domains or R2. Skip otherwise — the apps deploy
fine with just `.alchemy.env`.

> **🛑 AGENT PAUSE — ask two yes/no questions:**
>
> 1. *"Do you want to use your own domain (like `app.yourcompany.com`)?
>    If yes, the domain must already be managed by Cloudflare DNS, and
>    I'll need the exact web hostname and the API hostname (e.g.
>    `dev.yourcompany.com` and `api-dev.yourcompany.com`). If no, we'll
>    use the free `*.workers.dev` URLs and skip this."*
> 2. *"Do you need file storage (Cloudflare R2) for the server? If yes,
>    paste your R2 access key ID and secret access key. If no, skip."*
>
> If both answers are no → skip A3 entirely.
> Otherwise only write the keys the user actually provided into the
> matching `.dev.env` / `.prod.env` files.

```bash
# Custom domains (zone must be on Cloudflare DNS)
cat >> apps/server/.dev.env <<EOF
WEB_DOMAIN=dev.example.com
SERVER_DOMAIN=api-dev.example.com
EOF
cat >> apps/web/.dev.env <<EOF
WEB_DOMAIN=dev.example.com
SERVER_DOMAIN=api-dev.example.com
EOF

# R2 (server only)
cat >> apps/server/.dev.env <<EOF
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
EOF

# Same pattern for .prod.env when you're ready to deploy prod
```

(Domains need to live in both apps' files because each app's
`alchemy.run.ts` resolves the other side's URL independently.)

#### Adding `www` → apex (or any alias-to-canonical 301)

`alchemy.run.ts` only binds the canonical domain (`WEB_DOMAIN`). To make
`www.<your-apex>` also reach your site and 301 to the canonical, do this
**once in the Cloudflare dashboard** — not in code.

Why not IaC? alchemy has `DnsRecords` + `RedirectRule` resources that
could automate this, but they need two scopes that the
`pnpm dlx alchemy util create-cloudflare-token` helper does not request
by default:

- `Zone > DNS > Edit`
- `Zone > Single Redirect > Edit` (a.k.a. `Dynamic URL Redirects: Edit`)

Adding those scopes to the token is fine, but for a one-time setup the
dashboard route is faster and zero-config. The redirect rule template
described below is officially documented by Cloudflare — see
[Redirect www to domain apex](https://developers.cloudflare.com/pages/how-to/www-redirect/).

Prerequisite: prod is already deployed and `https://<your-apex>` returns
HTTP 200 (i.e. `WEB_DOMAIN=<your-apex>` is set and you've completed A5
or A8 once).

**Step 1 — Add a proxied DNS record for `www`**

1. Dashboard → your zone (e.g. `<your-apex>`) → **DNS → Records**
2. **Add record**

   | Field | Value |
   |---|---|
   | Type | `A` |
   | Name | `www` |
   | IPv4 address | `192.0.2.1` |
   | Proxy status | **Proxied** (orange cloud, required) |

   The IP is a documentation sentinel ([RFC 5737](https://www.rfc-editor.org/rfc/rfc5737)).
   Traffic never reaches it because step 2 intercepts the request at
   Cloudflare's edge before any origin lookup.

3. **Save**

**Step 2 — Create the Single Redirect rule from the official template**

1. Dashboard → your zone → **Rules → Overview** (URL pattern:
   `https://dash.cloudflare.com/<account_id>/<your-apex>/rules/overview`)
2. Find the **Redirect from WWW to root** template
3. **Create from template** — Cloudflare pre-fills:
   - **When incoming requests match** → Wildcard pattern → `https://www.*`
   - **Target URL** → `https://${1}`
   - **Status code** → `301`
   - **Preserve query string** → Enabled
4. **Deploy**

(The template's wildcard `https://www.*` matches `www.<anything>` within
the zone. Scoped to a single zone, this only ever fires for
`www.<your-apex>`. If you need a stricter match, switch to
`https://www.<your-apex>/*` → `https://<your-apex>/${1}`.)

**Verify**

```bash
curl -sI https://www.<your-apex>/some/path?q=1 | head -3
# Expect:
#   HTTP/2 301
#   location: https://<your-apex>/some/path?q=1
```

Single Redirects execute in the `http_request_dynamic_redirect` phase,
which runs **before** Workers — the redirected request never reaches
your Worker, so it doesn't count against Worker invocations.

#### Getting R2 keys

R2 needs an **Account API token** (S3-compatible key pair), *not* a User
API token. The two look similar in the dash but produce different
artifacts:

| | User API token | Account API token |
|---|---|---|
| Produces | Single bearer token | `Access Key ID` + `Secret Access Key` pair |
| Templates | "Edit Cloudflare Workers" etc. | R2 scopes only |
| Used for | Control-plane (the `CLOUDFLARE_API_TOKEN` we already minted) | S3 SDK access to R2 buckets |

Steps:

1. https://dash.cloudflare.com → **R2 Object Storage** (accept terms /
   add billing if first use; 10GB/month is free)
2. **Manage R2 API Tokens** → **Create Account API token**
3. Name: e.g. `saasflare-dev-r2`
4. Permissions: **Object Read & Write**
5. Optionally scope to specific bucket(s); leave TTL blank for no expiry
6. **Create Account API Token**
7. Copy `Access Key ID` and `Secret Access Key` — the Secret is shown
   **only once**, so capture it before closing the page

Paste the two values into `apps/server/.{stage}.env` as shown above.

### A4. Sync to GitHub Secrets

```bash
pnpm sync:secrets
```

Uploads `.alchemy.env` (as `ENV_ALCHEMY`) and the four
`apps/{server,web}/.{dev,prod}.env` files (as `ENV_{SERVER,WEB}_{DEV,PROD}`).
Missing files are skipped with a warning.

### A5. Push and watch

```bash
git push origin dev
gh run watch
```

`deploy.yml` runs test → deploy dev → resolve URL → e2e.

### A6. Verify

```bash
URLS=$(node \
  --env-file=.alchemy.env \
  --env-file=apps/server/.dev.env \
  scripts/resolve-urls.ts --stage dev)
echo "$URLS" | jq

SERVER=$(echo "$URLS" | jq -r .server)
WEB=$(echo "$URLS" | jq -r .web)
curl -fsS "$SERVER/health"     # → {"status":"ok"}
curl -fsSI "$WEB" | head -1    # → HTTP/2 200
```

### A7. PR previews

Already enabled by `.github/workflows/preview.yml`. Open a PR against
`dev` and within ~2 min the bot posts preview URLs as a PR comment.
Each PR gets isolated stage `pr-<N>` with its own KV/D1/R2/Workers.

### A8. Promoting to prod

> **🛑 AGENT PAUSE — require a typed confirmation:**
>
> Ask: *"Ready to promote to production. This deploys to the **real**
> prod stage on the `main` branch and will be visible to users. To
> confirm, type exactly `deploy prod`. Anything else cancels."*
>
> Only run the commands below if the user typed literally `deploy prod`.

```bash
git checkout main
git merge dev
git push origin main
```

Make sure `apps/{server,web}/.prod.env` exist locally (if you have prod
domains or R2 keys) and you've run `pnpm sync:secrets`.

---

## Path B — Local deploy

For debugging when CI is broken or you're iterating on `alchemy.run.ts`.

### B1. Preflight + env files

Same as A1–A3. Make sure `.alchemy.env` exists.

### B2. Deploy

```bash
pnpm run deploy:dev    # or deploy:prod (after typed `deploy prod` confirmation)
```

`scripts/deploy.sh` auto-sources `.alchemy.env` before invoking pnpm,
so the alchemy child processes inherit `CLOUDFLARE_API_TOKEN` etc.
Each app additionally loads its `.{stage}.env` via alchemy's
`--env-file` flag (which forwards to Node's `--env-file`).

No `source` step required.

### B3. Verify

Same as A6.

---

## Common issues

- **`computeWorkerDevDomain` errors / wrong URL**: alchemy hits
  `GET /accounts/{id}/workers/subdomain`. New CF accounts don't have a
  workers.dev subdomain until the first Worker is deployed. Workaround:
  `pnpm dlx wrangler deploy --name throwaway` once to provision the
  subdomain, then `wrangler delete throwaway`.

- **`gh secret set` fails with "no default repository"**: run
  `gh repo set-default` once.

- **Deploy fails on D1 with `CloudflareApiError: 401 Authentication
  error`** (KV created fine, then 401 on the first D1 resource): the
  `CLOUDFLARE_API_TOKEN` was minted from the dashboard "Edit Cloudflare
  Workers" template instead of `pnpm dlx alchemy util
  create-cloudflare-token`. That template is missing D1 (and a few
  others). Re-mint with the helper, update `.alchemy.env`, re-run
  `pnpm sync:secrets`, and re-push.

- **`pnpm run deploy:dev` says CF auth missing locally**: confirm
  `.alchemy.env` exists at the repo root and has all three keys filled
  in. The wrapper sources it but doesn't validate contents.

- **Custom domain stuck "pending"**: zone must be on Cloudflare DNS. If
  registered elsewhere, change nameservers at the registrar or transfer
  to CF.

- **`adopt: true` not adopting** (alchemy errors "resource already
  exists"): the existing resource name doesn't match
  `${PROJECT_NAME}-{kind}-${stage}`. Inspect with
  `pnpm dlx wrangler kv namespace list` / `wrangler d1 list`, rename or
  `alchemy destroy --stage <stage>` to start clean.

- **`pnpm sync:secrets` skips files**: by design — missing
  `.{stage}.env` files emit a warning, not an error. Create them if you
  want them synced.

- **PR preview ignores my custom domain**: by design —
  `apps/{server,web}/alchemy.run.ts` checks `app.stage.startsWith('pr-')`
  and skips `WEB_DOMAIN` / `SERVER_DOMAIN` env vars for those stages, so
  each PR gets a clean isolated `*.workers.dev` URL.

- **`www.<your-apex>` returns HTTP 530** (or `ERR_SSL_PROTOCOL_ERROR`,
  or DNS not found): only `WEB_DOMAIN` is bound to the Worker. `www`
  isn't part of the IaC config — add it in the dashboard per
  [Adding `www` → apex](#adding-www--apex-or-any-alias-to-canonical-301)
  above.

- **`ALCHEMY_STATE_TOKEN` rotation**: if lost or compromised, update
  `.alchemy.env` in **every** saasflare project on this CF account,
  re-sync secrets (`pnpm sync:secrets`), and redeploy each project
  (alchemy's `adopt: true` re-claims existing resources).
