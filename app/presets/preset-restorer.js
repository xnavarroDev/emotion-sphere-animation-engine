/**
 * Apply parsed preset tokens to live editor state.
 *
 * Parsing stays pure in preset-format.js; this module owns restoration order.
 * Firefly layers grow as their headers are encountered, then shrink only after
 * the complete document is known so a short preset cannot leave stale layers.
 * Browser presentation effects are explicit adapters supplied by app.js.
 */
export function restoreParsedPreset({
  parsedPreset,
  innerLayersReady,
  innerLayers,
  fireflyLayers,
  addFireflyLayer,
  removeLastFireflyLayer,
  sceneTimeline,
  classicState,
  hexToRgb,
  setCoreParameter,
  applyMode,
  switchEmotion,
  setPresetName,
  setGlowColor,
  setBackgroundColor,
  setSecondaryBackgroundColor,
  setSceneAnimation,
  setLoop,
  setGlowVisible,
  setFirefliesVisible,
  setGlowOpacity,
  setGradientAmount,
  setRotationEnabled,
  setRotationSpeed,
}) {
  const hasFireflySection = parsedPreset.hasFireflyLayers;
  if (parsedPreset.hasInnerLayers && innerLayersReady) {
    for (const layer of innerLayers) layer.overrides = {};
  }
  if (hasFireflySection) {
    for (const layer of fireflyLayers) {
      layer.overrides = {};
      layer.name = null;
    }
  }

  let fireflyIndex = 0;
  let maximumFireflyIndex = -1;
  let animationIndex = -1;
  let animationPhase = null;
  let section = null;
  let innerIndex = -1;

  for (const token of parsedPreset.tokens) {
    if (token.type === 'section') {
      section = token.section;
      if (section === 'layer') innerIndex = token.index;
      if (section === 'firefly') {
        fireflyIndex = token.index;
        while (fireflyIndex >= fireflyLayers.length && addFireflyLayer()) {}
        if (!token.legacy) maximumFireflyIndex = Math.max(maximumFireflyIndex, fireflyIndex);
      }
      if (section === 'animation') {
        animationIndex = token.index;
        animationPhase = null;
        while (animationIndex >= fireflyLayers.length && addFireflyLayer()) {}
        if (animationIndex === -2) sceneTimeline.length = 0;
        else if (fireflyLayers[animationIndex]) fireflyLayers[animationIndex].timeline.length = 0;
      }
      continue;
    }
    if (token.type === 'phase' && section === 'animation') {
      animationPhase = { duration: token.duration, snapshot: null };
      const timeline = animationIndex === -2
        ? sceneTimeline
        : fireflyLayers[animationIndex]?.timeline;
      timeline?.push(animationPhase);
      continue;
    }
    if (token.type === 'ease' && section === 'animation' && animationPhase) {
      animationPhase.ease = token.value;
      continue;
    }
    if (token.type === 'mode') { applyMode(token.value); continue; }
    if (token.type === 'override') {
      if (section === 'layer' && innerLayers[innerIndex]) {
        innerLayers[innerIndex].overrides[token.emotion] = hexToRgb(token.colour);
      }
      if (section === 'firefly' && fireflyLayers[fireflyIndex]) {
        fireflyLayers[fireflyIndex].overrides[token.emotion] = token.colour;
      }
      continue;
    }
    if (token.type === 'name' && section === 'firefly' && fireflyLayers[fireflyIndex]) {
      fireflyLayers[fireflyIndex].name = token.value || null;
      continue;
    }
    if (token.type === 'name' && section === 'animation' && animationPhase) {
      animationPhase.name = token.value || null;
      continue;
    }
    if (token.type === 'colour' && section === 'animation' && animationIndex >= 0 && animationPhase) {
      animationPhase.snapshot ||= { params: {} };
      animationPhase.snapshot.colour = token.value;
      continue;
    }
    if (token.type === 'emotion') { switchEmotion(token.value); continue; }
    if (token.type === 'presetName' && section === 'view') {
      setPresetName(token.value);
      continue;
    }
    if (token.type === 'colourSetting') {
      if (section === 'view') {
        if (token.key === 'glowcolor') setGlowColor(token.value);
        if (token.key === 'bgcolor2') setSecondaryBackgroundColor(token.value);
        if (token.key === 'bgcolor') setBackgroundColor(token.value);
        continue;
      }
      if (section === 'animation' && animationIndex === -2 && animationPhase) {
        animationPhase.snapshot ||= { classic: {} };
        if (token.key === 'glowcolor') animationPhase.snapshot.glowColor = token.value;
        if (token.key === 'bgcolor2') animationPhase.snapshot.bgColor2 = token.value;
        if (token.key === 'bgcolor') animationPhase.snapshot.bgColor = token.value;
        continue;
      }
    }
    if (token.type !== 'number') continue;
    const { key, value } = token;
    if (section === 'core') setCoreParameter(key, value);
    else if (section === 'layer') innerLayers[innerIndex]?.field.setParams({ [key]: value });
    else if (section === 'firefly') fireflyLayers[fireflyIndex]?.setParams({ [key]: value });
    else if (section === 'classic') {
      if (key in classicState) classicState[key] = value;
    } else if (section === 'animation') {
      if (key === 'animate') {
        if (animationIndex === -2) setSceneAnimation(Boolean(value));
        else if (fireflyLayers[animationIndex]) fireflyLayers[animationIndex].anim = Boolean(value);
      } else if (animationPhase) {
        if (animationIndex === -2) {
          animationPhase.snapshot ||= { classic: {} };
          if (key === 'glowopacity') animationPhase.snapshot.glowOpacity = value;
          else if (key === 'bggradient') animationPhase.snapshot.bgGradientAmount = value;
          else animationPhase.snapshot.classic[key] = value;
        } else if (fireflyLayers[animationIndex]) {
          animationPhase.snapshot ||= { params: {} };
          animationPhase.snapshot.params[key] = value;
        }
      }
    } else if (section === 'view') {
      if (key === 'loop') setLoop(Boolean(value));
      if (key === 'glow') setGlowVisible(Boolean(value));
      if (key === 'fireflies') setFirefliesVisible(Boolean(value));
      if (key === 'glowopacity') setGlowOpacity(value);
      if (key === 'bggradient') setGradientAmount(value);
      if (key === 'rotate') setRotationEnabled(Boolean(value));
      if (key === 'rotatespeed') setRotationSpeed(value);
    }
  }

  if (hasFireflySection) {
    while (fireflyLayers.length > maximumFireflyIndex + 1 && removeLastFireflyLayer()) {}
  }
  // Loaded values become the new resting look rather than temporary animated
  // values, which is what Reset must restore after loading this document.
  for (const layer of fireflyLayers) {
    if (layer.idle) layer.idle = { ...layer.params };
  }
}
