import { useToastStore } from 'src/stores/toastStore';

const ICONS: Record<string, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
};

export function ToastHost() {
  const toasts = useToastStore(state => state.toasts);
  const dismiss = useToastStore(state => state.dismiss);

  return (
    <div className="toast-wrap" aria-live="polite">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`toast toast-${t.tone}`}
          role="status"
          onClick={() => dismiss(t.id)}
        >
          <span className="toast-icon" aria-hidden="true">
            {ICONS[t.tone]}
          </span>
          <div>
            <div className="toast-title">{t.title}</div>
            {t.detail && <div>{t.detail}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
