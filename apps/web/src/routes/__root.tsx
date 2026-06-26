import { Toaster } from '@saasflare-dev/ui/components/sonner';
import { TooltipProvider } from '@saasflare-dev/ui/components/tooltip';
import uiGlobalsCss from '@saasflare-dev/ui/styles/globals.css?url';
import type { QueryClient } from '@tanstack/react-query';
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
} from '@tanstack/react-router';
import globalsCss from '~/styles/globals.css?url';

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'TanStack Start on Cloudflare Workers' },
      { name: 'description', content: 'Built with Alchemy' },
    ],
    links: [
      { rel: 'stylesheet', href: uiGlobalsCss },
      { rel: 'stylesheet', href: globalsCss },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    // data-app is a stable per-product identity anchor (decoupled from page
    // copy). The E2E guard (e2e/global-setup.ts) uses it to confirm it's
    // testing THIS app and not another saasflare product sharing port 3000.
    // Forked products must give this a unique value.
    <html lang="en" data-app="saasflare-starter">
      <head>
        <HeadContent />
      </head>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <TooltipProvider>
          <div className="min-h-svh w-full flex flex-col">
            <Outlet />
          </div>
          <Toaster richColors />
        </TooltipProvider>
        <Scripts />
      </body>
    </html>
  );
}
