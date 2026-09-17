/**
 * Presents the original animation Play and Loop controls.
 *
 * The redesigned transport and runtime API share the same playback state, so
 * this adapter owns only legacy DOM synchronization. Eligibility checks,
 * respawning, clocks, and stopping semantics remain canonical in app.js.
 */
export function createLegacyAnimationTransport({
  playButton,
  loopCheckbox,
  onPlayToggle,
  onLoopChange,
}) {
  playButton.addEventListener('click', onPlayToggle);
  loopCheckbox.addEventListener('change', () => onLoopChange(loopCheckbox.checked));

  function setPlaying(playing) {
    playButton.classList.toggle('active', playing);
  }

  function setLoop(looping) {
    loopCheckbox.checked = looping;
  }

  return { setLoop, setPlaying };
}
