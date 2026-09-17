import { setPressed } from './accessibility.js';

/**
 * Connects emotion/prototype selectors and presents their active state.
 * Callbacks own application changes; this adapter owns only DOM interaction.
 */
export function createEmotionControls({ document, onEmotion, onCycle, onPrototype }) {
  const emotionActions = new Map();

  document.querySelectorAll('#dots [data-emotion]').forEach(dot => {
    emotionActions.set(dot.id, () => onEmotion(dot.dataset.emotion));
    dot.addEventListener('click', () => emotionActions.get(dot.id)?.());
  });

  document.getElementById('d-cycle')?.addEventListener('click', onCycle);
  document.querySelectorAll('#proto-switch .proto').forEach(button => {
    button.addEventListener('click', () => onPrototype(button.dataset.proto));
  });

  return {
    setActive(id) {
      document.querySelectorAll('#dots .dot').forEach(dot => {
        const active = dot.id === id;
        dot.classList.toggle('active', active);
        setPressed(dot, active);
      });
    },

    setEmotionAction(id, action) {
      if (!emotionActions.has(id)) return false;
      emotionActions.set(id, action);
      return true;
    },

    setPrototypeActive(name) {
      document.querySelectorAll('#proto-switch .proto').forEach(button => {
        const active = button.dataset.proto === name;
        button.classList.toggle('active', active);
        setPressed(button, active);
      });
    },
  };
}
