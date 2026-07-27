export interface ToastItem {
  id: number;
}

// Picking up another tab's changes is silent — it is benign and constant. The
// one thing worth interrupting for is a note the user didn't create appearing
// because both versions of an edit were kept.
const MESSAGE = 'This note was also changed in another tab — both versions kept.';

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
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          style={{
            background: '#fff', borderRadius: 8, padding: '12px 14px',
            boxShadow: '0 6px 24px rgba(0,0,0,0.18)', border: '1px solid #e5e7eb',
            display: 'flex', gap: 10, alignItems: 'flex-start',
          }}
        >
          <div style={{ flex: 1, fontSize: '0.875rem', fontWeight: 600, color: '#111827' }}>{MESSAGE}</div>
          <button
            onClick={() => onDismiss(t.id)}
            aria-label="Dismiss"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#9ca3af', fontSize: '1.05rem', lineHeight: 1, padding: '0 2px',
            }}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
