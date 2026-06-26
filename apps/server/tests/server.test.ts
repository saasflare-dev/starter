import { describe, expect, it } from 'vitest';
import app from '../src/index';

/**
 * Full-stack smoke test.
 *
 * Purpose: a single safety net to run after bumping underlying packages
 * (Hono, oRPC, Zod, Drizzle, @aws-sdk/*, the Cloudflare runtime, ...). It
 * exercises every binding (D1 · KV · R2) and every RPC procedure against the
 * real miniflare runtime, so a regression in any layer fails loudly here
 * instead of leaking to production.
 *
 * Scope intentionally favors breadth over depth — one happy path per feature.
 * Add focused tests in dedicated files for edge cases.
 */

async function rpc(path: string, input?: unknown) {
  const urlPath = path.replace(/\./g, '/');
  const resp = await app.fetch(
    new Request(`http://localhost/rpc/${urlPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ json: input }),
    }),
  );
  const raw = (await resp.json()) as { json?: unknown };
  return { status: resp.status, body: raw.json };
}

describe('HTTP + routing (Hono)', () => {
  it('GET / returns hello message', async () => {
    const res = await app.fetch(new Request('http://localhost/'));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('Hello saasflare starter server!');
  });
});

describe('Health checks (bindings wired)', () => {
  it.each([
    ['healthCheck.connection'],
    ['healthCheck.db'],
    ['healthCheck.kv'],
    ['healthCheck.r2'],
  ])('%s returns OK', async (procedure) => {
    const { status, body } = await rpc(procedure);
    expect(status).toBe(200);
    expect(body).toBe('OK');
  });
});

describe('Planet (static oRPC + output schema)', () => {
  it('lists 8 planets', async () => {
    const { status, body } = await rpc('planet.list');
    expect(status).toBe(200);
    const planets = body as Array<{ name: string }>;
    expect(planets).toHaveLength(8);
    expect(planets[0].name).toBe('Mercury');
  });
});

describe('Todos CRUD (D1 + Drizzle)', () => {
  it('create → list → update → delete', async () => {
    const { status: createStatus, body: created } = await rpc(
      'todos.createTodo',
      { text: 'smoke todo' },
    );
    expect(createStatus).toBe(200);
    const todo = created as { id: number; text: string; completed: boolean };
    expect(todo.text).toBe('smoke todo');
    expect(todo.completed).toBe(false);

    const { body: listed } = await rpc('todos.getTodos');
    expect(
      (listed as Array<{ id: number }>).some((t) => t.id === todo.id),
    ).toBe(true);

    const { status: updateStatus, body: updated } = await rpc(
      'todos.updateTodo',
      { id: todo.id, completed: true },
    );
    expect(updateStatus).toBe(200);
    expect((updated as { completed: boolean }).completed).toBe(true);

    const { status: deleteStatus } = await rpc('todos.deleteTodo', {
      id: todo.id,
    });
    expect(deleteStatus).toBe(200);

    const { body: afterDelete } = await rpc('todos.getTodos');
    expect(
      (afterDelete as Array<{ id: number }>).some((t) => t.id === todo.id),
    ).toBe(false);
  });
});

describe('Users CRUD (D1 + Drizzle + Zod email)', () => {
  it('create → list → update → delete', async () => {
    const email = `smoke-${crypto.randomUUID()}@example.com`;
    const { status: createStatus, body: created } = await rpc(
      'users.createUser',
      { name: 'Smoke', email },
    );
    expect(createStatus).toBe(200);
    const user = created as { id: number; name: string; email: string };
    expect(user.email).toBe(email);

    const { body: listed } = await rpc('users.getUsers');
    expect(
      (listed as Array<{ id: number }>).some((u) => u.id === user.id),
    ).toBe(true);

    const { status: updateStatus, body: updated } = await rpc(
      'users.updateUser',
      { id: user.id, name: 'Smoke Renamed' },
    );
    expect(updateStatus).toBe(200);
    expect((updated as { name: string }).name).toBe('Smoke Renamed');

    const { status: deleteStatus } = await rpc('users.deleteUser', {
      id: user.id,
    });
    expect(deleteStatus).toBe(200);
  });

  it('rejects an invalid email (Zod validation)', async () => {
    const { status } = await rpc('users.createUser', {
      name: 'Bad',
      email: 'not-an-email',
    });
    expect(status).not.toBe(200);
  });
});

describe('Storage / R2 (AWS S3 SDK + native R2 binding)', () => {
  it('presign returns signed upload URLs', async () => {
    const { status, body } = await rpc('storage.presign', [
      { filename: 'a.txt', contentType: 'text/plain' },
    ]);
    expect(status).toBe(200);
    const urls = body as Array<{ url: string; key: string; filename: string }>;
    expect(urls).toHaveLength(1);
    expect(urls[0].url).toMatch(/^https:\/\//);
    expect(urls[0].filename).toBe('a.txt');
  });

  it('list returns objects from the bucket', async () => {
    const { status, body } = await rpc('storage.list');
    expect(status).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });

  it('delete succeeds (idempotent on missing key)', async () => {
    const { status, body } = await rpc('storage.delete', {
      key: 'does-not-exist',
    });
    expect(status).toBe(200);
    expect((body as { success: boolean }).success).toBe(true);
  });
});
