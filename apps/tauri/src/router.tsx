import {
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';
import { Shell } from './components/shell';
import { Playground } from './routes/playground';
import { Settings } from './routes/settings';

const rootRoute = createRootRoute({ component: Shell });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Playground,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/settings',
  component: Settings,
});

export const router = createRouter({
  routeTree: rootRoute.addChildren([indexRoute, settingsRoute]),
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
