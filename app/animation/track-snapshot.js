/**
 * Applies a stored phase snapshot to the live editor through explicit scene
 * adapters. This is intentionally separate from playback interpolation: phase
 * editing restores exact authored values, while playback blends between them.
 */
export function applyTrackSnapshotToEditor({
  snapshot,
  sceneTrack,
  stopPlayback,
  classicState,
  setGlowOpacity,
  setGlowColor,
  setBackgroundColor,
  setSecondaryBackgroundColor,
  setGradientAmount,
  syncClassic,
  syncBackground,
  layer,
  layerIndex,
  selectLayer,
  syncLayer,
  onApplied,
}) {
  if (!snapshot) return false;
  stopPlayback();

  if (sceneTrack) {
    // Ignore unknown keys so presets from a newer renderer remain safe to open
    // in an older editor without growing accidental state on CLASSIC.
    if (snapshot.classic) {
      for (const [key, value] of Object.entries(snapshot.classic)) {
        if (key in classicState) classicState[key] = value;
      }
    }
    if (typeof snapshot.glowOpacity === 'number') setGlowOpacity(snapshot.glowOpacity);
    if (snapshot.glowColor) setGlowColor(snapshot.glowColor);
    if (snapshot.bgColor) setBackgroundColor(snapshot.bgColor);
    if (snapshot.bgColor2) setSecondaryBackgroundColor(snapshot.bgColor2);
    if (typeof snapshot.bgGradientAmount === 'number') setGradientAmount(snapshot.bgGradientAmount);
    syncClassic();
    syncBackground();
  } else if (snapshot.params) {
    layer.setParams({ ...snapshot.params });
    if (snapshot.colour) layer.setColor(snapshot.colour);
    // Keep the field panel on the same layer as the phase being edited; this
    // prevents a visible slider from silently editing another track.
    selectLayer(layerIndex);
  }

  onApplied();
  syncLayer();
  return true;
}
