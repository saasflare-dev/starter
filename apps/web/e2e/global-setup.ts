// Guard: fail fast if the E2E target is the WRONG app.
//
// starter, website and onePay all default their web dev server to port 3000.
// With `reuseExistingServer: true`, Playwright reuses whatever is already on
// :3000 — so if another saasflare product is running, the whole suite would
// silently run against it (and fail in confusing ways, or worse, pass).
//
// This runs once before the suite: it fetches the target URL and checks the
// served page is actually the starter web app. If not, it aborts with a
// message naming what it found instead.

// Stable identity anchor rendered into every page's root <html> tag
// (`data-app="..."` in apps/web/src/routes/__root.tsx). Decoupled from page
// copy on purpose, so editing titles/marketing text never breaks this guard.
const EXPECTED_APP_ID = 'saasflare-starter';

function targetUrl(): string {
  return process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';
}

async function fetchHtml(url: string, timeoutMs: number): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let lastErr: unknown;
  // Poll until reachable — globalSetup may run before the dev server is up.
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      return await res.text();
    } catch (err) {
      lastErr = err;
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  throw new Error(`Could not reach ${url} within ${timeoutMs}ms: ${lastErr}`);
}

export default async function globalSetup(): Promise<void> {
  const url = targetUrl();
  const html = await fetchHtml(url, 60_000);

  if (new RegExp(`data-app=["']${EXPECTED_APP_ID}["']`).test(html)) return;

  // Wrong app — surface its <title> so it's obvious which one answered.
  const match = html.match(/<title>([^<]*)<\/title>/i);
  const found = match ? `"${match[1].trim()}"` : '(no <title> element found)';

  throw new Error(
    [
      '',
      '✗ E2E aborted — the app answering on the test URL is NOT the starter web app.',
      '',
      `    URL:              ${url}`,
      `    expected data-app: "${EXPECTED_APP_ID}"`,
      `    got page titled:   ${found}`,
      '',
      '  Another saasflare product (website / onePay) is probably running on',
      '  port 3000, and Playwright reused it (reuseExistingServer). Free the',
      '  port, then re-run:',
      '',
      '    lsof -nP -iTCP:3000 -sTCP:LISTEN   # find what is holding it',
      '',
    ].join('\n'),
  );
}
