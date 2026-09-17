/**
 * Apply embed-only body classes before the asynchronous application starts.
 * This small classic script intentionally runs synchronously from index.html,
 * preventing slow or blocked dependencies from exposing authoring controls.
 */
(() => {
  const query = new URLSearchParams(window.location.search);
  const kiosk = query.get('mode') === 'kiosk' || query.get('embed') === '1';
  if (!kiosk) return;

  document.body.classList.add('kiosk');
  if (query.get('dots') === '0') document.body.classList.add('watch');
  if (query.get('solid') === '1') document.body.classList.add('solid-bg');
})();
