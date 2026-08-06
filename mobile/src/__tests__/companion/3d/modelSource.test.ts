import { resolveModelSource, doesCatGlbExist } from '../../../services/companion/3d/modelSource';
import { CAT_GLB_PATH } from '../../../services/companion/assetPaths';

jest.mock('expo-file-system/legacy', () => ({
  getInfoAsync: jest.fn(),
}));

import * as FileSystem from 'expo-file-system/legacy';

const mockGetInfoAsync = FileSystem.getInfoAsync as jest.Mock;

describe('resolveModelSource', () => {
  it('resolves to 3d with the DLC cat.glb URI when installed and present', () => {
    const res = resolveModelSource(true, true);
    expect(res.kind).toBe('3d');
    if (res.kind === '3d') {
      expect(res.source).toEqual({ uri: CAT_GLB_PATH });
    }
  });

  it('falls back to 2d when not installed even if the file exists', () => {
    expect(resolveModelSource(false, true).kind).toBe('2d');
  });

  it('falls back to 2d when installed but the model is missing', () => {
    expect(resolveModelSource(true, false).kind).toBe('2d');
  });

  it('falls back to 2d when neither condition holds', () => {
    expect(resolveModelSource(false, false).kind).toBe('2d');
  });
});

describe('doesCatGlbExist', () => {
  beforeEach(() => {
    mockGetInfoAsync.mockReset();
  });

  it('returns true when the file exists on disk', async () => {
    mockGetInfoAsync.mockResolvedValue({ exists: true });
    expect(await doesCatGlbExist()).toBe(true);
    expect(mockGetInfoAsync).toHaveBeenCalledWith(CAT_GLB_PATH);
  });

  it('returns false when the file is missing', async () => {
    mockGetInfoAsync.mockResolvedValue({ exists: false });
    expect(await doesCatGlbExist()).toBe(false);
  });

  it('returns false when the filesystem check throws', async () => {
    mockGetInfoAsync.mockRejectedValue(new Error('disk error'));
    expect(await doesCatGlbExist()).toBe(false);
  });
});
