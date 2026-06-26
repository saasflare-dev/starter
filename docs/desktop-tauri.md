# Desktop app (Tauri 2.0)

`apps/tauri` is a **template** for a cross-platform desktop client that talks to
this monorepo's server. It ships the parts every desktop app needs — system
tray, window-to-tray behavior, single-instance, native notifications,
launch-at-login, and an auto-updater hook — plus a **Todos playground** that
exercises the server's oRPC API end to end.

It is meant to be **copied and rebranded** for a real product, or deleted if you
don't need a desktop client.

## Prerequisites

- Rust toolchain (`rustup`) — required to compile the native shell.
- Platform deps per the [Tauri prerequisites](https://tauri.app/start/prerequisites/)
  (e.g. Xcode CLT on macOS, `webkit2gtk` on Linux).

## Run it

```bash
# 1. Start the backend (serves /rpc on :4000) — the playground needs it.
pnpm --filter @saasflare-dev/server dev

# 2. Launch the desktop app (Vite on :4200 + the native window).
pnpm --filter @saasflare-dev/tauri app:dev
```

Other scripts: `vite:dev` (frontend only, in a browser), `vite:build`,
`app:build` (produce installers), `icons` (regenerate placeholder icons),
`typecheck`, `lint`. There is intentionally **no `dev` script**, so the
top-level `pnpm dev` (server + web) doesn't try to compile the native app.

## Layout

```
apps/tauri/
  index.html              # webview entry + global CSS
  vite.config.ts          # single window entry
  src/
    main.tsx              # QueryClientProvider + Router
    router.tsx            # routes: / (playground), /settings
    components/
      shell.tsx           # top bar + nav sidebar + <Outlet/>
      context-menu.tsx    # reusable right-click menu + confirm dialog
    lib/
      orpc.ts             # narrow oRPC client (see "Typing" below)
      query.ts            # singleton QueryClient + query keys
      desktop.ts          # autostart / notification / updater / tray badge
      ui.ts               # neutral design tokens (swap for your brand)
    routes/
      playground.tsx      # Todos CRUD over oRPC (right-click a row to delete)
      settings.tsx        # desktop capabilities demo
  src-tauri/
    src/main.rs           # tray, window events, single-instance, plugins
    Cargo.toml            # native deps
    tauri.conf.json       # windows, bundle
    capabilities/default.json
    icons/                # placeholder icons (regenerate with `pnpm tauri icon`)
  scripts/make-icons.mjs  # generates placeholder PNGs incl. tray glyphs
```

## The playground (oRPC → server → D1)

`src/routes/playground.tsx` is the desktop analogue of the web app's
playground. It calls the **unauthenticated** `todos` service
(`packages/api/src/todos.ts`) via TanStack Query:

```ts
const todosQ = useQuery({ queryKey: ['todos'], queryFn: () => client.todos.getTodos() });
const createM = useMutation({
  mutationFn: (text: string) => client.todos.createTodo({ text }),
  onSuccess: () => qc.invalidateQueries({ queryKey: ['todos'] }),
});
```

To add another service, declare its procedures on `AppClient` in `lib/orpc.ts`
and call `client.yourService.method(...)` — no server changes needed beyond the
usual `appRouter` wiring.

### Typing: why a narrow client

`lib/orpc.ts` does **not** import the server's `AppRouterClient`. Doing so pulls
the entire Worker source — which needs `cloudflare:workers`/Zod types this app's
tsconfig doesn't have — into the desktop typecheck. Instead we hand-declare an
`AppClient` interface covering only the procedures we call. The trade-off:
no automatic end-to-end type sync, but a self-contained desktop build. If you
prefer full type safety and can tolerate the type deps, import `AppRouterClient`
and `createTanstackQueryUtils` like the web app does.

## Common desktop capabilities

All wired in `src-tauri/src/main.rs` and surfaced via `src/lib/desktop.ts` /
`src/routes/settings.tsx`:

| Capability | Where | Notes |
|---|---|---|
| System tray | `main.rs` `TrayIconBuilder` | Open/Quit menu; left-click opens menu |
| Close → hide to tray | `main.rs` `on_window_event` | App stays resident; tray reopens it |
| Tray badge | `set_badge` command → `lib/desktop.ts` `setBadge()` | macOS shows the count by the menu-bar icon |
| Single instance | `tauri-plugin-single-instance` | Second launch focuses the existing window |
| Native notifications | `tauri-plugin-notification` → `notify()` | Requests permission on first use |
| Launch at login | `tauri-plugin-autostart` → `autostart.*` | Toggle in Settings |
| Auto-update | `tauri-plugin-updater` → `checkForUpdate()` | **Release builds only — see below** |

### Configuring the updater

The updater plugin **requires** a `plugins.updater` config (endpoints + public
key) at startup, so it is registered **only in release builds**
(`#[cfg(not(debug_assertions))]` in `main.rs`). In `app:dev` it isn't loaded, so
`checkForUpdate()` returns `{ status: 'not-configured' }` and Settings shows a
hint instead of crashing.

Before your first **release** build (`app:build`), add the block below to
`tauri.conf.json` — otherwise the release binary panics on launch when the
plugin can't find its config:

```jsonc
// tauri.conf.json → "plugins"
"updater": {
  "endpoints": ["https://releases.example.com/{{target}}/{{arch}}/{{current_version}}"],
  "pubkey": "<your tauri signing public key>"
}
```

Endpoints **must use `https`** — a plain `http://` URL (even `http://localhost`)
makes the release binary panic at startup with _"the configured updater endpoint
must use a secure protocol"_. The URL isn't fetched until `checkForUpdate()`
runs, so it only needs to be a valid `https` URL at build time, not yet live.

`endpoints` may use the placeholders `{{target}}` (`darwin`/`linux`/`windows`),
`{{arch}}` (`aarch64`/`x86_64`), and `{{current_version}}`. The simplest setup
is a **single static `latest.json`** served from a fixed URL (R2, a CDN, or a
GitHub release asset) that lists every platform — then no placeholders are
needed:

```jsonc
"updater": {
  "endpoints": ["https://releases.example.com/desktop/latest.json"],
  "pubkey": "<contents of myapp.key.pub>"
}
```

#### The update manifest (`latest.json`)

The endpoint returns this JSON. The updater compares `version` against the
running app's `version` (from `tauri.conf.json`) and, if newer, downloads the
matching `platforms` entry and verifies its `signature` against `pubkey` before
installing:

```json
{
  "version": "0.1.1",
  "notes": "What changed in this release",
  "pub_date": "2026-06-26T00:00:00Z",
  "platforms": {
    "darwin-aarch64": {
      "signature": "<contents of the .app.tar.gz.sig file>",
      "url": "https://releases.example.com/desktop/0.1.1/Saasflare-Desktop_aarch64.app.tar.gz"
    },
    "darwin-x86_64": {
      "signature": "<.sig contents>",
      "url": "https://releases.example.com/desktop/0.1.1/Saasflare-Desktop_x64.app.tar.gz"
    },
    "linux-x86_64": {
      "signature": "<.sig contents>",
      "url": "https://releases.example.com/desktop/0.1.1/saasflare-desktop_0.1.1_amd64.AppImage"
    },
    "windows-x86_64": {
      "signature": "<.sig contents>",
      "url": "https://releases.example.com/desktop/0.1.1/Saasflare-Desktop_0.1.1_x64-setup.nsis.zip"
    }
  }
}
```

Platform keys are `{os}-{arch}` (`darwin`/`linux`/`windows` × `aarch64`/`x86_64`);
include only the targets you actually ship. Note the macOS updater artifact is
the **`.app.tar.gz`** (not the `.dmg`), and Windows uses the **`.nsis.zip`** /
`.msi.zip` (not the bare installer) — Tauri only emits these archive variants
when `updater` is configured.

#### Signing a release

The private key signs each bundle; the public key (`pubkey` above) verifies it
on the client. **Never commit or ship the private key.**

First, tell the bundler to emit updater artifacts — without this, `app:build`
produces only the `.dmg`/installer and **no `.sig`**, so there is nothing to
reference from the manifest:

```jsonc
// tauri.conf.json → "bundle"
"createUpdaterArtifacts": true
```

Then generate keys and build:

```bash
# 1. One-time: generate a keypair. Writes myapp.key (private) + myapp.key.pub.
#    Copy the printed public key into tauri.conf.json → plugins.updater.pubkey.
pnpm tauri signer generate -w ~/.tauri/saasflare-desktop.key

# 2. Build a signed release. The private key + its password sign every bundle.
TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/saasflare-desktop.key)" \
TAURI_SIGNING_PRIVATE_KEY_PASSWORD="<key password, or empty>" \
pnpm --filter @saasflare-dev/tauri app:build
```

Each bundle is emitted with a sibling `.sig` file under
`src-tauri/target/release/bundle/` (e.g. `*.app.tar.gz.sig`, `*.AppImage.sig`,
`*.nsis.zip.sig`). Paste each `.sig`'s **contents** into the matching
`signature` field of `latest.json`, upload the bundles to the `url`s, then
publish `latest.json` at the endpoint. In CI, inject the same two env vars as
secrets — see the [Tauri updater docs](https://tauri.app/plugin/updater/).

#### Updater signing ≠ Apple/OS code signing

These are two unrelated signatures — don't confuse them:

- **Updater signature** (the minisign key above) — proves an update package came
  from you and wasn't tampered with. This is **all the auto-updater needs**, it's
  free, and it has **nothing to do with Apple**.
- **OS code signing** (macOS Developer ID + notarization, ~$99/yr Apple Developer
  account; Windows Authenticode) — satisfies Gatekeeper/SmartScreen so the OS
  trusts the app's publisher. Configured separately via `bundle.macOS` +
  `APPLE_*` env vars.

**You can ship and auto-update without an Apple account.** The updater verifies
its own signature and replaces the app in place, so updates apply regardless of
OS code signing. The only cost is the *install* experience: an unsigned macOS app
trips Gatekeeper on first launch ("unidentified developer" — user right-clicks →
Open, or runs `xattr -cr App.app`); updates delivered by the running app usually
don't re-trigger that prompt. For a real product, add Developer ID signing +
notarization to remove the warnings — but it is **not** a prerequisite for the
updater to work.

## Auth

The template ships **no auth** — the `todos` playground is unauthenticated, so
it works out of the box against the bare starter. When your product needs
authenticated calls, attach a bearer token to the oRPC link in `lib/orpc.ts`
(the `headers` option) and add a token store. A common desktop pattern is to
sign in via the system browser and hand the session back over a custom deep-link
scheme (`tauri-plugin-deep-link` + `tauri-plugin-opener`), which this template
intentionally leaves out to stay minimal.

## Rebranding checklist

The template uses neutral placeholders. Before shipping a real app, replace:

- **`tauri.conf.json`** — `productName`, `identifier`, window `title`.
- **`Cargo.toml`** — `package.name`, `description`.
- **`src-tauri/src/main.rs`** — `APP_NAME`.
- **`lib/ui.ts`** — accent color and type stack.
- **Icons** — run `pnpm tauri icon path/to/1024.png` for the full platform set,
  and replace `icons/tray.png` + `icons/tray-template.png` (the macOS template
  glyph should be black on transparent; macOS recolors it for the menu bar).
  `scripts/make-icons.mjs` only produces flat placeholders.

## Going further: a frameless HUD/toast window

For always-on-top custom notifications or a HUD, add a second window to
`tauri.conf.json` (`transparent: true`, `decorations: false`, `alwaysOnTop`,
`skipTaskbar`) plus its own HTML/JS entry in `vite.config.ts`, enable the
`macos-private-api` Tauri feature for transparency, and position it with the
`core:window` permissions. The template ships only native notifications to keep
the surface small.
