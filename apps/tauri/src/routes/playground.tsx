import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type CSSProperties, useState } from 'react';
import {
  ConfirmDialog,
  type ConfirmState,
  ContextMenu,
  useContextMenu,
} from '../components/context-menu';
import { client, type Todo } from '../lib/orpc';
import { queryKeys } from '../lib/query';
import { ui } from '../lib/ui';

/**
 * Playground: a Todo CRUD demo wired to the server's `todos` oRPC service —
 * the desktop equivalent of the web app's playground. It exercises the full
 * client → oRPC → D1 round-trip with TanStack Query (useQuery / useMutation +
 * invalidateQueries). `todos` is unauthenticated, so this works signed-out.
 */

const eyebrowStyle: CSSProperties = {
  fontFamily: ui.mono,
  fontSize: 10.5,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: ui.faint,
};

function Spinner({
  color = ui.muted,
  size = 12,
}: {
  color?: string;
  size?: number;
}) {
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        border: `2px solid ${color}`,
        borderTopColor: 'transparent',
        display: 'inline-block',
        animation: 'spin 0.6s linear infinite',
      }}
    />
  );
}

function TodoRow({
  todo,
  onToggle,
  onDelete,
  onContextMenu,
  busy,
}: {
  todo: Todo;
  onToggle: (completed: boolean) => void;
  onDelete: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  busy: boolean;
}) {
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: right-click menu is a desktop affordance; the row's actions stay reachable via the visible checkbox/delete controls.
    <div
      onContextMenu={onContextMenu}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 12px 12px 14px',
        borderTop: `1px solid ${ui.borderHair}`,
        opacity: busy ? 0.5 : 1,
      }}
    >
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={(e) => onToggle(e.target.checked)}
        style={{
          width: 16,
          height: 16,
          accentColor: ui.accent,
          cursor: 'pointer',
        }}
      />
      <span
        style={{
          flex: 1,
          minWidth: 0,
          fontSize: 14,
          color: todo.completed ? ui.muted : ui.ink,
          textDecoration: todo.completed ? 'line-through' : 'none',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {todo.text}
      </span>
      <button
        type="button"
        onClick={onDelete}
        disabled={busy}
        title="Delete"
        style={{
          flex: 'none',
          width: 30,
          height: 30,
          border: 'none',
          borderRadius: 8,
          background: 'transparent',
          color: ui.faint,
          cursor: busy ? 'default' : 'pointer',
        }}
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
          <title>Delete</title>
          <path
            d="M3 4.5h10M6.5 4.5V3.2c0-.4.3-.7.7-.7h1.6c.4 0 .7.3.7.7v1.3M5 4.5l.5 8c0 .5.4.9.9.9h3.2c.5 0 .9-.4.9-.9l.5-8"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}

export function Playground() {
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const { menu, open: openMenu, close: closeMenu } = useContextMenu();
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);

  const todosQ = useQuery({
    queryKey: queryKeys.todos,
    queryFn: () => client.todos.getTodos(),
  });

  const invalidate = () =>
    void qc.invalidateQueries({ queryKey: queryKeys.todos });

  const createM = useMutation({
    mutationFn: (todoText: string) =>
      client.todos.createTodo({ text: todoText }),
    onSuccess: () => {
      setText('');
      invalidate();
    },
  });

  const updateM = useMutation({
    mutationFn: (input: { id: number; completed: boolean }) =>
      client.todos.updateTodo(input),
    onSuccess: invalidate,
  });

  const deleteM = useMutation({
    mutationFn: (id: number) => client.todos.deleteTodo({ id }),
    onSuccess: invalidate,
  });

  const todos = todosQ.data ?? [];

  // Right-click a row → menu → confirm → delete. Exercises the reusable
  // context-menu + confirm-dialog primitives in components/context-menu.tsx.
  const askDelete = (todo: Todo) =>
    setConfirm({
      title: 'Delete todo?',
      body: `“${todo.text}” will be permanently removed.`,
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: () => deleteM.mutate(todo.id),
    });

  const onRowContextMenu = (e: React.MouseEvent, todo: Todo) =>
    openMenu(e, [
      { label: 'Delete', danger: true, onSelect: () => askDelete(todo) },
    ]);

  return (
    <section
      className="hide-scroll"
      style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        minHeight: 0,
        background: ui.surface,
        padding: '20px 40px 48px',
      }}
    >
      <div
        style={{
          maxWidth: 640,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
        }}
      >
        <header style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={eyebrowStyle}>Playground</span>
          <h1
            style={{
              margin: 0,
              fontSize: 28,
              fontWeight: 500,
              letterSpacing: '-0.025em',
            }}
          >
            Todos
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 14.5,
              lineHeight: 1.65,
              color: ui.textSecondary,
            }}
          >
            A live demo of calling the server's oRPC API from the desktop
            client. Each action round-trips to the worker and D1; the list
            refreshes via query invalidation.
          </p>
        </header>

        {/* New todo */}
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="What needs doing?"
            spellCheck={false}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && text.trim()) createM.mutate(text.trim());
            }}
            style={{
              flex: 1,
              minWidth: 0,
              border: `1px solid ${ui.borderStrong}`,
              borderRadius: 10,
              padding: '11px 14px',
              fontSize: 14,
              color: ui.ink,
              background: ui.surface,
              fontFamily: ui.font,
            }}
          />
          <button
            type="button"
            disabled={!text.trim() || createM.isPending}
            onClick={() => createM.mutate(text.trim())}
            style={{
              flex: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              border: 'none',
              borderRadius: 10,
              padding: '11px 20px',
              fontSize: 14,
              fontWeight: 500,
              cursor: text.trim() ? 'pointer' : 'default',
              background: text.trim() ? ui.accent : ui.surfaceAlt,
              color: text.trim() ? '#fff' : ui.faint,
              fontFamily: ui.font,
            }}
          >
            {createM.isPending ? <Spinner color="#fff" /> : null}
            Add
          </button>
        </div>

        {/* List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span style={eyebrowStyle}>Your todos</span>
          {todosQ.isLoading ? (
            <span style={{ fontSize: 13, color: ui.muted }}>Loading…</span>
          ) : todosQ.isError ? (
            <span style={{ fontSize: 13, color: ui.fail }}>
              Couldn't reach the server. Is it running on{' '}
              <code style={{ fontFamily: ui.mono }}>:4000</code>?
            </span>
          ) : todos.length === 0 ? (
            <span style={{ fontSize: 13, color: ui.muted }}>
              No todos yet — add one above.
            </span>
          ) : (
            <div
              style={{
                border: `1px solid ${ui.borderHair}`,
                borderRadius: 12,
                overflow: 'hidden',
              }}
            >
              {/* First row has no top border via the row's own borderTop trick */}
              <div style={{ marginTop: -1 }}>
                {todos.map((t) => (
                  <TodoRow
                    key={t.id}
                    todo={t}
                    busy={
                      (updateM.isPending && updateM.variables?.id === t.id) ||
                      (deleteM.isPending && deleteM.variables === t.id)
                    }
                    onToggle={(completed) =>
                      updateM.mutate({ id: t.id, completed })
                    }
                    onDelete={() => deleteM.mutate(t.id)}
                    onContextMenu={(e) => onRowContextMenu(e, t)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <ContextMenu menu={menu} onClose={closeMenu} />
      <ConfirmDialog confirm={confirm} onClose={() => setConfirm(null)} />
    </section>
  );
}
