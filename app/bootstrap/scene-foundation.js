import { createSceneRuntime } from '../scene/scene-runtime.js';
import { createShellParticleState } from '../scene/shell-particle-state.js';
import { createFacetGlowTexture, createRadialGlowTexture } from '../scene/particle-materials.js';
import { createSceneSettingsController } from '../ui/controls/scene-settings-controller.js';
import { createLegacyViewControls } from '../ui/legacy/legacy-view-controls.js';

/**
 * Creates the renderer, background, outer shell, and scene-wide control policy.
 * These objects have a shared lifetime and must exist before either the legacy
 * or redesigned editor captures their mutation callbacks.
 */
export function initializeSceneFoundation({
  THREE,
  documentLike,
  mount,
  viewport,
  settings,
  createCloudBackground,
  shellCount,
}){
  const runtime=createSceneRuntime({
    THREE,
    mount,
    width:viewport.width,
    height:viewport.height,
    pixelRatio:viewport.pixelRatio,
  });
  const {scene,camera,group}=runtime;
  const cloud=createCloudBackground(scene,camera,group);
  const glowTexture=createRadialGlowTexture({THREE,documentLike});
  const facetGlowTexture=createFacetGlowTexture({THREE,documentLike});

  const shellState=createShellParticleState({count:shellCount});
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(shellState.positions,3));
  geometry.setAttribute('color',new THREE.BufferAttribute(shellState.colors,3));
  const material=new THREE.PointsMaterial({
    size:0.018,
    map:glowTexture,
    vertexColors:true,
    transparent:true,
    opacity:0.52,
    alphaTest:0.01,
    blending:THREE.AdditiveBlending,
    depthWrite:false,
    sizeAttenuation:true,
    fog:false,
  });
  const points=new THREE.Points(geometry,material);
  group.add(points);

  const settingsController=createSceneSettingsController({
    documentLike,
    settings,
    sceneRuntime:runtime,
  });
  const controls={
    setRotationEnabled:settingsController.setRotationEnabled,
    setRotationSpeed:settingsController.setRotationSpeed,
    applyBackground:settingsController.applyBackground,
    setPrimaryColor:settingsController.setPrimaryColor,
    setSecondaryColor:settingsController.setSecondaryColor,
    setGradientAmount:settingsController.setGradientAmount,
  };

  // Compatibility controls intentionally remain available, but now delegate
  // to the same canonical scene settings used by the redesigned panel.
  createLegacyViewControls({
    documentLike,
    getGradientAmount:()=>settings.gradientAmount,
    getRotationEnabled:()=>settings.rotationEnabled,
    setGlowVisible:visible=>cloud.setVisible(visible),
    setFirefliesVisible:visible=>{ points.visible=visible; },
    setGlowColor:value=>{ settings.glowColor=value; cloud.setUserTint(value,null); },
    setGlowOpacity:value=>{ settings.glowOpacity=value; cloud.setUserTint(null,value); },
    setPrimaryBackground:controls.setPrimaryColor,
    setSecondaryBackground:controls.setSecondaryColor,
    setGradientAmount:controls.setGradientAmount,
    setRotationEnabled:controls.setRotationEnabled,
    setRotationSpeed:value=>{ settings.rotationSpeed=value; },
  });

  return {
    runtime,
    scene,
    camera,
    group,
    cloud,
    textures:{glow:glowTexture,facetGlow:facetGlowTexture},
    shell:{...shellState,geometry,material,points},
    settingsController,
    controls,
  };
}
