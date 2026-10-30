// Persists the save in localStorage, and exports/imports it as a file.
import { emptySave, parseSave, type SaveData } from '../progress';

const KEY = 'better-dots-save';

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return parseSave(JSON.parse(raw));
    // Settings saved by the first prototype.
    const old = JSON.parse(localStorage.getItem('better-dots-settings') ?? '{}');
    const save = emptySave();
    save.settings.colorblind = old.colorblind === true;
    return save;
  } catch (err) {
    console.warn('Could not read save; starting fresh', err);
    return emptySave();
  }
}

export function storeSave(save: SaveData): void {
  localStorage.setItem(KEY, JSON.stringify(save));
}

export function exportSave(save: SaveData): void {
  const blob = new Blob([JSON.stringify(save, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `better-dots-save-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Asks for a save file. Resolves with the parsed save, or null if cancelled. Rejects if the file is bad. */
export function pickSaveFile(): Promise<SaveData | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      try {
        resolve(parseSave(JSON.parse(await file.text())));
      } catch (err) {
        reject(err);
      }
    });
    input.click();
  });
}
