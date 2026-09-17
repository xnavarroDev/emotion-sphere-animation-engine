import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const failures = [];
const ignoredDirectories = new Set(['.git', 'node_modules', 'test-results']);

function fail(message) {
  failures.push(message);
}

function projectFiles(directory = root) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return ignoredDirectories.has(entry.name) ? [] : projectFiles(absolute);
    }
    return [absolute];
  });
}

function relative(absolute) {
  return path.relative(root, absolute).replaceAll('\\', '/');
}

const files = projectFiles();
const javascriptFiles = files.filter(file => /\.(?:js|mjs)$/.test(file));

for (const file of javascriptFiles) {
  const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  if (result.status !== 0) {
    fail(`${relative(file)} failed syntax checking:\n${(result.stderr || result.stdout).trim()}`);
  }
}

const appFiles = javascriptFiles.filter(file => relative(file).startsWith('app/'));
for (const file of appFiles) {
  const source = readFileSync(file, 'utf8');
  const importPattern = /(?:from\s*|import\s*\()(['"])(\.\.?\/[^'"]+)\1/g;
  for (const match of source.matchAll(importPattern)) {
    const specifier = match[2].split('?')[0];
    const resolved = path.resolve(path.dirname(file), specifier);
    if (!existsSync(resolved)) fail(`${relative(file)} imports missing local module ${specifier}`);
  }
}

// Composition and bootstrap code is read frequently during feature work. Keep
// those architectural boundaries scannable without forcing a formatter onto
// renderer/math modules where long expressions may be clearer intact.
const readabilityFiles = appFiles.filter(file => {
  const modulePath = relative(file);
  return modulePath === 'app/app.js'
    || modulePath.startsWith('app/bootstrap/')
    || modulePath === 'app/scene/layer-presets.js';
});
for (const file of readabilityFiles) {
  readFileSync(file, 'utf8').split(/\r?\n/).forEach((line, index) => {
    if (line.length > 120) fail(`${relative(file)}:${index + 1} exceeds the 120-character readability limit`);
  });
}

const indexPath = path.join(root, 'index.html');
const indexHtml = readFileSync(indexPath, 'utf8');
const indexLines = indexHtml.split(/\r?\n/).length;
if (indexLines > 300) fail(`index.html has ${indexLines} lines; keep the shell below 300`);
if (/<style\b/i.test(indexHtml)) fail('index.html must not contain inline <style> blocks');
if (/\son[a-z]+\s*=/i.test(indexHtml)) fail('index.html must not contain inline event handlers');

const scriptTags = [...indexHtml.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
if (!scriptTags.length) fail('index.html must load application scripts');
for (const [, attributes, body] of scriptTags) {
  if (!/\bsrc\s*=/.test(attributes)) fail('index.html contains a script without a src attribute');
  if (body.trim()) fail('index.html contains inline JavaScript');
}
if (!/<script\b[^>]*type=["']module["'][^>]*src=["']app\/app\.js(?:\?[^"']*)?["']/i.test(indexHtml)) {
  fail('index.html must load app/app.js as an ES module');
}

const appPath = path.join(root, 'app', 'app.js');
const appSource = readFileSync(appPath, 'utf8');
const appLines = appSource.split(/\r?\n/).length;
if (appLines > 568) fail(`app/app.js has ${appLines} lines; extract code instead of raising the 568-line ceiling`);
// The entry point should compose feature bootstraps, not gradually resume
// importing every leaf controller that those features use internally.
const directAppImports = [...appSource.matchAll(/^import\b/gm)].length;
if (directAppImports > 25) fail(`app/app.js has ${directAppImports} direct imports; add or extend a feature bootstrap instead of raising the 25-import ceiling`);

const windowAssignments = [...appSource.matchAll(/\bwindow\.([A-Za-z_$][\w$]*)\s*=/g)]
  .map(match => match[1]);
const unexpectedWindowAssignments = windowAssignments.filter(name => name !== 'emotionSphere');
if (unexpectedWindowAssignments.length) {
  fail(`unexpected window assignments: ${[...new Set(unexpectedWindowAssignments)].join(', ')}`);
}

const requiredModules = [
  'app/bootstrap/application-state.js',
  'app/bootstrap/animation-runtime.js',
  'app/bootstrap/core-runtime.js',
  'app/bootstrap/editor-runtime.js',
  'app/bootstrap/editor-shell.js',
  'app/bootstrap/legacy-animation-editor.js',
  'app/bootstrap/layer-control-suite.js',
  'app/bootstrap/parameter-editor.js',
  'app/bootstrap/preset-runtime.js',
  'app/bootstrap/scene-render-runtime.js',
  'app/bootstrap/scene-foundation.js',
  'app/bootstrap/timeline-editor.js',
  'app/bootstrap/thumbnail-runtime.js',
  'app/scene/layer-presets.js',
  'app/animation/timeline.js',
  'app/animation/timeline-layout.js',
  'app/animation/timeline-seek.js',
  'app/animation/timeline-edit.js',
  'app/animation/playback-plan.js',
  'app/animation/frame-runner.js',
  'app/animation/playback-state.js',
  'app/animation/playback-session.js',
  'app/animation/default-timeline.js',
  'app/animation/default-timeline-seeder.js',
  'app/animation/firefly-transition.js',
  'app/animation/scene-transition.js',
  'app/animation/scene-transition-adapters.js',
  'app/animation/track-snapshot.js',
  'app/animation/timeline-workspace.js',
  'app/presets/preset-format.js',
  'app/presets/preset-document-controller.js',
  'app/presets/preset-restorer.js',
  'app/presets/preset-restore-context.js',
  'app/presets/preset-state.js',
  'app/presets/share-url.js',
  'app/runtime/emotion-api.js',
  'app/runtime/app-readiness.js',
  'app/runtime/kiosk-runtime.js',
  'app/state/undo-history.js',
  'app/state/scene-settings.js',
  'app/scene/color.js',
  'app/scene/classic-particle-state.js',
  'app/scene/classic-renderer-settings.js',
  'app/scene/core-prototypes.js',
  'app/scene/emotions.js',
  'app/scene/emotion-state.js',
  'app/scene/emotion-cycle.js',
  'app/scene/firefly-layer-collection.js',
  'app/scene/palette.js',
  'app/scene/scene-runtime.js',
  'app/scene/scene-frame-runner.js',
  'app/scene/sphere-drag.js',
  'app/scene/sphere-presentation.js',
  'app/scene/shell-particle-state.js',
  'app/scene/particle-materials.js',
  'app/scene/particle-appearance.js',
  'app/scene/particle-effects.js',
  'app/scene/particle-frame-state.js',
  'app/scene/inner-layer-presentation.js',
  'app/scene/layer-factories.js',
  'app/scene/layer-reset.js',
  'app/scene/particle-colors.js',
  'app/scene/particle-integrator.js',
  'app/scene/particle-motion.js',
  'app/scene/particle-spawner.js',
  'app/scene/particle-trails.js',
  'app/thumbnails/lru-cache.js',
  'app/thumbnails/capture-queue.js',
  'app/thumbnails/capture-session.js',
  'app/thumbnails/render-surface.js',
  'app/thumbnails/strip-layout.js',
  'app/ui/accessibility.js',
  'app/ui/timeline/animation-track-selector.js',
  'app/ui/controls/background-controls.js',
  'app/ui/controls/classic-emitter-controls.js',
  'app/ui/controls/core-prototype-controls.js',
  'app/ui/controls/firefly-field-controls.js',
  'app/ui/controls/inner-layer-controls.js',
  'app/ui/controls/layer-controls.js',
  'app/ui/controls/rotation-controls.js',
  'app/ui/controls/scene-settings-controller.js',
  'app/ui/controls/sphere-mode-controls.js',
  'app/ui/runtime-errors.js',
  'app/ui/controls/parameter-groups.js',
  'app/ui/shell/disclosures.js',
  'app/ui/shell/preset-footer.js',
  'app/ui/shell/preset-gallery.js',
  'app/ui/shell/panel-shell.js',
  'app/ui/shell/editor-viewport.js',
  'app/ui/timeline/easing-menu.js',
  'app/ui/emotion-controls.js',
  'app/ui/timeline/timeline-resize.js',
  'app/ui/timeline/timeline-panel.js',
  'app/ui/timeline/timeline-lanes.js',
  'app/ui/timeline/timeline-render-model.js',
  'app/ui/timeline/timeline-render-assembler.js',
  'app/ui/timeline/timeline-renderer.js',
  'app/ui/timeline/timeline-transport.js',
  'app/ui/timeline/timeline-render-finalizer.js',
  'app/ui/timeline/timeline-render-actions.js',
  'app/ui/timeline/timeline-phase-row.js',
  'app/ui/timeline/timeline-track-label.js',
  'app/ui/legacy/legacy-view-controls.js',
  'app/ui/legacy/legacy-preset-actions.js',
  'app/ui/legacy/legacy-animation-transport.js',
  'app/ui/legacy/legacy-phase-list.js',
  'app/ui/timeline/phase-placement.js',
  'app/ui/timeline/thumbnail-strip.js',
  'app/ui/timeline/thumbnail-preview.js',
  'app/ui/timeline/timeline-elements.js',
  'app/ui/timeline/timeline-gestures.js',
  'app/ui/timeline/timeline-editors.js',
  'app/ui/timeline/timeline-selection.js',
  'app/ui/timeline/live-phase-editor.js',
];
for (const modulePath of requiredModules) {
  if (!existsSync(path.join(root, modulePath))) fail(`required architecture module is missing: ${modulePath}`);
}

if (failures.length) {
  console.error(`Quality checks failed (${failures.length}):`);
  failures.forEach(message => console.error(`- ${message}`));
  process.exitCode = 1;
} else {
  console.log(`Quality checks passed: ${javascriptFiles.length} scripts, ${appFiles.length} app modules, ${indexLines}-line HTML shell, ${appLines}-line entry module.`);
}
