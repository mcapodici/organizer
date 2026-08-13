import { X } from 'lucide-react';

export interface ToastItem {
  id: number;
  imported: number;
  conflicts: number;
}

function describe(t: ToastItem): { title: string; sub?: string } {
  if (t.imported > 0) {
    const noun = t.imported === 1 ? 'note' : 'notes';
    return {
      title: `Merged ${t.imported} ${noun} from another device`,
      sub: t.conflicts > 0
        ? `${t.conflicts} had a conflicting version — both versions kept.`
        : undefined,
    };
  }
  return { title: 'Loaded the latest changes from another device' };
}

// Bottom-right stack of merge announcements. Each stays until the user
// acknowledges it (no auto-dismiss), so a merge that happened while they were
// away is never missed.
export function ToastStack({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 16, right: 16, zIndex: 10000,
      display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 'min(360px, 90vw)',
    }}>
      {toasts.map((t) => {
        const { title, sub } = describe(t);
        return (
          <div
            key={t.id}
            role="status"
            style={{
              background: 'var(--surface)', borderRadius: 'var(--radius-md)', padding: '12px 14px',
              boxShadow: '0 6px 24px rgba(0,0,0,0.18)', border: '1px solid var(--border)',
              display: 'flex', gap: 10, alignItems: 'flex-start',
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-strong)' }}>{title}</div>
              {sub && <div style={{ fontSize: '0.8rem', color: 'var(--text-subtle)', marginTop: 3, lineHeight: 1.4 }}>{sub}</div>}
            </div>
            <button
              onClick={() => onDismiss(t.id)}
              aria-label="Dismiss"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--text-faint)', display: 'flex', alignItems: 'center', padding: '0 2px',
              }}
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
