import { QueryClient } from '@tanstack/react-query';

/** Shared singleton so non-component code can also invalidate queries. */
export const queryClient = new QueryClient();

export const queryKeys = {
  todos: ['todos'] as const,
};
