/**
 * Owns the editor's focused timeline and translates live scene state into
 * timeline snapshots. Keeping this index-to-track mapping in one place avoids
 * subtle disagreements between the legacy phase list and the modern timeline.
 */
export function createTimelineWorkspace({
  getLayers,
  sceneTimeline,
  classicState,
  sceneSettings,
  colorToHex,
}) {
  if (typeof getLayers !== 'function') throw new TypeError('getLayers must be a function');
  if (!Array.isArray(sceneTimeline)) throw new TypeError('sceneTimeline must be an array');
  if (typeof colorToHex !== 'function') throw new TypeError('colorToHex must be a function');

  let activeTrackIndex = 0;
  const layers = () => getLayers() || [];

  // Track rows always place the scene after the current layer collection.
  // Looking up the layer count lazily keeps the mapping valid after add/remove.
  function isSceneTrack(index = activeTrackIndex) {
    return index >= layers().length;
  }

  function setActiveTrack(index) {
    activeTrackIndex = index;
  }

  function getActiveTimeline() {
    return isSceneTrack()
      ? sceneTimeline
      : layers()[activeTrackIndex].timeline;
  }

  function getAllTimelines() {
    return [...layers().map(layer => layer.timeline), sceneTimeline];
  }

  function captureSnapshot(index) {
    if (isSceneTrack(index)) {
      return {
        classic: { ...classicState },
        glowOpacity: sceneSettings.glowOpacity,
        glowColor: sceneSettings.glowColor,
        bgColor: sceneSettings.backgroundColor,
        bgColor2: sceneSettings.secondaryBackgroundColor,
        bgGradientAmount: sceneSettings.gradientAmount,
      };
    }

    const layer = layers()[index];
    return {
      params: { ...layer.params },
      colour: colorToHex(layer.color()),
    };
  }

  return {
    get activeTrackIndex() { return activeTrackIndex; },
    setActiveTrack,
    isSceneTrack,
    getActiveTimeline,
    getAllTimelines,
    captureSnapshot,
    captureActiveSnapshot: () => captureSnapshot(activeTrackIndex),
  };
}
