/** Keep custom control ARIA state updates consistent across UI presenters. */
export function setPressed(control, pressed) {
  if (!control) return;
  control.setAttribute('aria-pressed', String(Boolean(pressed)));
}

export function setExpanded(control, expanded) {
  if (!control) return;
  control.setAttribute('aria-expanded', String(Boolean(expanded)));
}

export function setSliderValue(control, value, valueText = String(value)) {
  if (!control) return;
  control.setAttribute('aria-valuenow', String(value));
  control.setAttribute('aria-valuetext', valueText);
}
