import * as FileSystem from 'expo-file-system/legacy';
import type { BufferSource } from 'react-native-filament';
import { CAT_GLB_PATH } from '../assetPaths';

export type ModelResolution =
  | { kind: '3d'; source: BufferSource }
  | { kind: '2d' };

/**
 * Pure resolver: the 3D model is only used when the DLC bundle is installed
 * AND the cat.glb file exists on disk. Otherwise we fall back to the 2D
 * sprite. Bundled assets are NEVER used for the 3D model (DLC-only rule).
 */
export function resolveModelSource(installed: boolean, modelExists: boolean): ModelResolution {
  if (installed && modelExists) {
    return { kind: '3d', source: { uri: CAT_GLB_PATH } };
  }
  return { kind: '2d' };
}

/**
 * Check whether cat.glb is present in the DLC install dir.
 */
export async function doesCatGlbExist(): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(CAT_GLB_PATH);
    return info.exists;
  } catch {
    return false;
  }
}
