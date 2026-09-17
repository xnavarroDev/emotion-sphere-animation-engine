/**
 * Presents the redesigned timeline transport while delegating playback state.
 *
 * Playback plans and clocks remain application-owned. This adapter guarantees
 * that play/pause icons, loop button accessibility, and retained legacy loop
 * controls all reflect the same canonical state after every user action or
 * programmatic preset restore.
 */
export function createTimelineTransport({
  playButton,
  resetButton,
  loopButton,
  playIcon,
  getPlaying,
  startPlayback,
  stopPlayback,
  resetPlayback,
  getLoop,
  setLoop,
  onLoopChange,
  legacyTransport,
  setPressed,
  beforePlayToggle = () => {},
}) {
  function setPlaying(playing) {
    playIcon.src = playing ? 'icons/pause.svg' : 'icons/play.svg';
  }

  function syncLoop() {
    const looping = getLoop() !== false;
    loopButton.classList.toggle('on', looping);
    setPressed(loopButton, looping);
    legacyTransport.setLoop(looping);
  }

  playButton.addEventListener('click', () => {
    beforePlayToggle();
    if (getPlaying()) {
      stopPlayback();
      setPlaying(false);
      return;
    }
    if (startPlayback() !== false) setPlaying(true);
  });
  resetButton.addEventListener('click', () => {
    resetPlayback();
    setPlaying(false);
  });
  loopButton.addEventListener('click', () => {
    setLoop(!getLoop());
    syncLoop();
    onLoopChange();
  });

  syncLoop();
  setPlaying(getPlaying());
  return { setPlaying, syncLoop };
}
