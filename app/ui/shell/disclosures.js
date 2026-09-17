import { setExpanded } from '../accessibility.js';

// Centralizes the two disclosure conventions used by the parameter panel.
// Top-level sections hide with `.collapsed`; nested parameter groups reveal
// with `.open`. Keeping both here prevents their chevrons and aria-expanded
// values from drifting out of sync with the actual content state.
export function wireCollapsedSection({ trigger, section, initiallyExpanded = true }) {
  function present(expanded) {
    section.classList.toggle('collapsed', !expanded);
    trigger.querySelector('.chev')?.classList.toggle('rp-flip-y', expanded);
    setExpanded(trigger, expanded);
  }
  present(initiallyExpanded);
  trigger.addEventListener('click', () => present(section.classList.contains('collapsed')));
  return { setExpanded: present };
}

export function wireAccordionGroup({ trigger, group, initiallyExpanded = false }) {
  function present(expanded) {
    group.classList.toggle('open', expanded);
    trigger.querySelector('.chev')?.classList.toggle('rp-flip-y', expanded);
    setExpanded(trigger, expanded);
  }
  present(initiallyExpanded);
  trigger.addEventListener('click', () => present(!group.classList.contains('open')));
  return { setExpanded: present };
}

// The legacy animation panel predates the class-based disclosure conventions
// above and still uses inline display/rotation styles. Keep that compatibility
// detail here so app.js does not need a third disclosure implementation.
export function wireLegacyDisclosure({ trigger, body, chevron, initiallyExpanded = true }) {
  function present(expanded) {
    body.style.display = expanded ? '' : 'none';
    chevron.style.transform = expanded ? 'rotate(90deg)' : 'rotate(0deg)';
    setExpanded(trigger, expanded);
  }
  present(initiallyExpanded);
  trigger.addEventListener('click', () => present(body.style.display === 'none'));
  return { setExpanded: present };
}
