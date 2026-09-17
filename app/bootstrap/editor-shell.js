import { createPanelShell } from '../ui/shell/panel-shell.js';
import { createPresetGallery } from '../ui/shell/preset-gallery.js';
import { createPresetFooter } from '../ui/shell/preset-footer.js';
import { wireCollapsedSection } from '../ui/shell/disclosures.js';

/**
 * Initializes the redesigned editor shell and its preset-document chrome.
 *
 * The gallery and footer intentionally live together: the gallery asks whether
 * a document is dirty, while footer changes queue a refreshed gallery preview.
 * Keeping that feedback loop here avoids exposing either controller globally.
 */
export function initializeEditorShell({
  documentLike,
  clipboard,
  confirmDiscard,
  readiness,
  undoHistory,
  captureCurrentPreview,
  loadPreset,
  layoutViewport,
}){
  const timelineContainer=documentLike.getElementById('anim-canvas-controls');
  const timelineTracks=documentLike.getElementById('rp-tracks');

  createPanelShell({
    documentLike,
    // Renderer startup can finish later; this callback resolves the current
    // layout hook only when a user action actually needs it.
    onLayout:layoutViewport,
  });

  let footer=null;
  const gallery=createPresetGallery({
    documentLike,
    captureCurrentPreview,
    serializeDefault:()=>readiness.serialize(null),
    restoreDefault:text=>readiness.restore(text),
    loadPreset,
    hasUnsavedChanges:()=>footer?.isDirty||false,
    resetUnsavedState:()=>footer?.reset({clearName:true}),
    confirmDiscard,
  });
  readiness.registerDefaultCapture(gallery.captureDefault);

  // These are top-level document sections, so they begin expanded. The shared
  // disclosure adapter keeps visual, keyboard, and ARIA state synchronized.
  wireCollapsedSection({
    trigger:documentLike.getElementById('rp-describe-head'),
    section:documentLike.getElementById('rp-describe-section'),
  });
  wireCollapsedSection({
    trigger:documentLike.getElementById('rp-params-head'),
    section:documentLike.getElementById('rp-params-section'),
  });

  footer=createPresetFooter({
    documentLike,
    clipboard,
    serialize:()=>readiness.serialize(),
    onDirty:()=>{
      undoHistory.markDirty();
      gallery.queuePreviewRefresh();
    },
  });

  return {
    timelineContainer,
    timelineTracks,
    markDirty:()=>footer.markDirty(),
  };
}
