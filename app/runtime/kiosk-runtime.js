export const KIOSK_EMOTION_BY_DOT = Object.freeze({
  'd-blue': 'sad',
  'd-yellow': 'warm',
  'd-red': 'anger',
  'd-purple': 'calm',
});

export const KIOSK_DOT_BY_EMOTION = Object.freeze(
  Object.fromEntries(Object.entries(KIOSK_EMOTION_BY_DOT).map(([dot, emotion]) => [emotion, dot])),
);

/**
 * Convert the public URL contract into a small boot descriptor. Keeping query
 * policy here makes preset precedence testable without starting WebGL.
 */
export function parseKioskRuntimeQuery(search = '') {
  const query = new URLSearchParams(search);
  const preset = query.get('preset');
  return {
    kiosk: query.get('mode') === 'kiosk' || query.get('embed') === '1',
    preset,
    // A shared look is authoritative; an emotion must not overwrite it after
    // the asynchronous preset restore completes.
    emotion: preset ? null : query.get('emotion'),
  };
}

/**
 * Coordinate kiosk-only presentation and external runtime commands. Renderer
 * readiness, preset decoding, and DOM adapters are injected so this module
 * remains useful in embeds without knowing authoring-panel internals.
 */
export function createKioskRuntimeController({
  windowLike,
  body,
  emotionControls,
  emotionApi,
  applyPresetWhenReady,
  decodePreset,
  setDotActive,
  warn = (...args) => console.warn(...args),
}) {
  let connected = false;

  function markEmotion(emotion) {
    setDotActive(KIOSK_DOT_BY_EMOTION[String(emotion || '').toLowerCase()]);
  }

  function playEmotion(emotion) {
    // Selection feedback is immediate. Fetch/apply failures stay non-fatal for
    // host pages and are reported through the same warning channel as before.
    markEmotion(emotion);
    return emotionApi.play(emotion).catch(error => warn(error.message));
  }

  function configure(search = windowLike.location?.search || '') {
    const options = parseKioskRuntimeQuery(search);
    if (!options.kiosk) return options;

    body.classList.add('kiosk');
    for (const [dotId, emotion] of Object.entries(KIOSK_EMOTION_BY_DOT)) {
      emotionControls.setEmotionAction(dotId, () => playEmotion(emotion));
    }
    return options;
  }

  async function applyInitialSelection(options) {
    if (options.preset) {
      try {
        await applyPresetWhenReady(decodePreset(options.preset));
      } catch (error) {
        // Malformed shared URLs should leave a usable kiosk rather than fail
        // the renderer's startup promise.
        warn('bad preset param', error);
      }
      if (options.kiosk) body.classList.add('watch');
      return;
    }
    if (options.emotion) playEmotion(options.emotion);
  }

  function connectMessages() {
    if (connected) return;
    connected = true;
    windowLike.addEventListener('message', event => {
      const message = event.data;
      if (message && message.type === 'emotion' && message.value) {
        playEmotion(message.value);
      }
    });
  }

  return {
    applyInitialSelection,
    configure,
    connectMessages,
    playEmotion,
  };
}
