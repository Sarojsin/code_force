import * as FileSystem from 'expo-file-system/legacy';

export const COMPANION_DIR = (FileSystem.documentDirectory ?? '') + 'companion/';
export const SPRITESHEET_PNG = COMPANION_DIR + 'spritesheet.png';
export const SPRITESHEET_JSON = COMPANION_DIR + 'spritesheet.json';
export const DIALOGUES_FILE = COMPANION_DIR + 'dialogues.json';
export const SOUNDS_DIR = COMPANION_DIR + 'sounds/';

export async function areAssetsInstalled(): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(COMPANION_DIR);
    return info.exists;
  } catch {
    return false;
  }
}

export async function getAssetsSize(): Promise<number> {
  try {
    const info = await FileSystem.getInfoAsync(COMPANION_DIR);
    return (info as any).size ?? 0;
  } catch {
    return 0;
  }
}
