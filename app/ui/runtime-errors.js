/**
 * Installs the unobtrusive error panel used when WebGL or async boot fails.
 * Keeping this diagnostic visible is important for kiosk deployments, where
 * a blank canvas would otherwise hide the only actionable failure message.
 */
export function installRuntimeErrorOverlay({ windowLike, documentLike }) {
  const box = documentLike.createElement('div');
  box.id = 'err';
  Object.assign(box.style, {
    position: 'fixed',
    left: '12px',
    bottom: '12px',
    maxWidth: '46vw',
    zIndex: '9999',
    padding: '10px 12px',
    border: '1px solid rgba(255,80,80,0.35)',
    background: 'rgba(10,0,0,0.65)',
    color: 'rgba(255,170,170,0.95)',
    font: '11px/1.35 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
    whiteSpace: 'pre-wrap',
    pointerEvents: 'none',
    display: 'none',
  });

  const show = message => {
    box.textContent = message;
    box.style.display = 'block';
  };
  documentLike.addEventListener('DOMContentLoaded', () => documentLike.body.appendChild(box));
  windowLike.addEventListener('error', event => show(String(event.message || event.error || event)));
  windowLike.addEventListener('unhandledrejection', event => {
    show(`Unhandled promise rejection:\n${String(event.reason || event)}`);
  });
  return box;
}
