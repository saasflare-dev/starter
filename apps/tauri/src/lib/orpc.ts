import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';

/**
 * oRPC client for the server API — same wire protocol the web app uses. The
 * `todos` service is unauthenticated, so the playground works with no session.
 * Add a bearer header here (and a token store) if you wire up auth.
 *
 * Typed locally (NOT via the server's `AppRouterClient`) on purpose: importing
 * the root `@saasflare-dev/api` pulls the whole Worker source — which needs
 * `cloudflare:workers`/`zod` types this desktop tsconfig doesn't have — into
 * the app's typecheck. A narrow contract covering only the procedures we call
 * keeps the desktop build self-contained. Add procedures here as you use them.
 */
export interface Todo {
  id: number;
  text: string;
  completed: boolean;
  createdAt: string | Date;
}

interface AppClient {
  todos: {
    getTodos: () => Promise<Todo[]>;
    createTodo: (input: { text: string }) => Promise<Todo>;
    updateTodo: (input: {
      id: number;
      text?: string;
      completed?: boolean;
    }) => Promise<Todo>;
    deleteTodo: (input: { id: number }) => Promise<Todo>;
  };
}

// Release builds can bake the deployed URL in via CI (Vite env); dev builds
// fall back to the local server on :4000.
const serverUrl =
  import.meta.env.VITE_DEFAULT_SERVER_URL ?? 'http://localhost:4000';

const link = new RPCLink({ url: `${serverUrl}/rpc` });

export const client = createORPCClient(link) as unknown as AppClient;
