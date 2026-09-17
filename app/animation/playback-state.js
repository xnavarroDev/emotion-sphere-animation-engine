/**
 * Owns the mutable clock shared by playback, seeking, transports, and captures.
 * Centralizing these values prevents partial resets. For example, rewinding
 * `time` while accidentally retaining a seek hold or previous loop position.
 */
export function createPlaybackState({ loop = true } = {}) {
  const state = {
    playing: false,
    time: 0,
    previousGlobalTime: 0,
    loop,
    seekHold: null,
    scrubbing: false,
  };

  state.resetClock = () => {
    state.time = 0;
    state.previousGlobalTime = 0;
    state.seekHold = null;
  };
  state.beginScrub = time => {
    if (time !== undefined) state.time = time;
    state.scrubbing = true;
  };
  state.endScrub = () => { state.scrubbing = false; };
  state.capture = () => ({ time: state.time, loop: state.loop });
  state.restoreCapture = snapshot => {
    state.time = snapshot.time;
    state.loop = snapshot.loop;
    state.scrubbing = false;
  };

  return state;
}
