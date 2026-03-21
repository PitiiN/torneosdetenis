type Mode = 'admin' | 'user';
type Listener = (mode: Mode) => void;

let currentMode: Mode = 'user';
const listeners: Set<Listener> = new Set();

export const adminModeService = {
  getMode: () => currentMode,
  setMode: (mode: Mode) => {
    currentMode = mode;
    listeners.forEach(l => l(mode));
  },
  subscribe: (listener: Listener) => {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }
};
