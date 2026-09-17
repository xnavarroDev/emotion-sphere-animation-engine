/**
 * Lazily creates the phase easing popup and owns its dismissal lifecycle.
 * Timeline mutation stays in the injected selection callback.
 */
export function createEasingMenu({ documentLike, windowLike, groups, onSelect }) {
  if (!documentLike || !windowLike || !groups || !onSelect) {
    throw new TypeError('documentLike, windowLike, groups, and onSelect are required');
  }

  let element = null;
  let activePhase = null;

  function ensureElement() {
    if (element) return element;
    element = documentLike.createElement('div');
    element.className = 'rp-ease-menu';
    element.setAttribute('role', 'menu');
    element.setAttribute('aria-label', 'Phase easing');
    documentLike.body.appendChild(element);
    element.addEventListener('click', event => event.stopPropagation());
    return element;
  }

  function close() {
    if (element) element.style.display = 'none';
    activePhase = null;
  }

  function open(anchor, phase) {
    const menu = ensureElement();
    if (activePhase === phase && menu.style.display === 'block') {
      close();
      return;
    }

    activePhase = phase;
    const current = phase.ease || 'smootherstep';
    menu.replaceChildren();

    for (const [groupLabel, items] of groups) {
      const heading = documentLike.createElement('div');
      heading.className = 'rp-ease-group';
      heading.textContent = groupLabel;
      heading.setAttribute('role', 'presentation');
      menu.appendChild(heading);

      for (const [key, label] of items) {
        const button = documentLike.createElement('button');
        button.type = 'button';
        button.className = `rp-ease-item${key === current ? ' on' : ''}`;
        button.textContent = label;
        button.setAttribute('role', 'menuitemradio');
        button.setAttribute('aria-checked', String(key === current));
        button.addEventListener('click', () => {
          onSelect(phase, key);
          close();
        });
        menu.appendChild(button);
      }
    }

    menu.style.display = 'block';
    const anchorRect = anchor.getBoundingClientRect();
    const below = anchorRect.bottom + 6;
    const above = anchorRect.top - menu.offsetHeight - 6;
    menu.style.top = `${below + menu.offsetHeight < windowLike.innerHeight ? below : Math.max(6, above)}px`;
    menu.style.left = `${Math.max(6, Math.min(
      windowLike.innerWidth - menu.offsetWidth - 6,
      anchorRect.left + anchorRect.width / 2 - menu.offsetWidth / 2,
    ))}px`;
  }

  function handleKeydown(event) {
    if (event.key === 'Escape') close();
  }

  function connect() {
    documentLike.addEventListener('click', close);
    documentLike.addEventListener('keydown', handleKeydown);
  }

  function disconnect() {
    documentLike.removeEventListener('click', close);
    documentLike.removeEventListener('keydown', handleKeydown);
    element?.remove();
    element = null;
    activePhase = null;
  }

  return { open, close, connect, disconnect };
}
