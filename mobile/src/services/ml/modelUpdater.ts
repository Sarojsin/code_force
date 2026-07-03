import NetInfo from '@react-native-community/netinfo';
import { api } from 'src/services/api/client';
import { EncryptedStorage } from 'src/services/storage';
import { wellnessClassifier } from './wellnessClassifier';
import { minilmEmbedder } from './minilmEmbedder';
import { ModelVersionResponse } from './wellnessTypes';

class ModelUpdater {
  async checkForUpdate(): Promise<{ wellness: boolean; minilm: boolean }> {
    const netState = await NetInfo.fetch();
    if (!netState.isConnected || netState.type !== 'wifi') return { wellness: false, minilm: false };

    const [wellnessUpdated, minilmUpdated] = await Promise.all([
      this.checkWellnessUpdate(),
      this.checkMinilmUpdate(),
    ]);
    return { wellness: wellnessUpdated, minilm: minilmUpdated };
  }

  private async checkWellnessUpdate(): Promise<boolean> {
    const res = await api.get<ModelVersionResponse>('/api/v1/models/wellness-classifier/version');
    const remote = res.data;
    const local = await EncryptedStorage.getItem('wellness_model_version');
    if (remote.version === local) return false;
    return this.downloadUpdate('wellness-classifier', remote, () => wellnessClassifier.initialize());
  }

  private async checkMinilmUpdate(): Promise<boolean> {
    const res = await api.get<ModelVersionResponse>('/api/v1/models/minilm-embedder/version');
    const remote = res.data;
    const local = await EncryptedStorage.getItem('minilm_model_version');
    if (remote.version === local) return false;
    return this.downloadUpdate('minilm-embedder', remote, () => minilmEmbedder.initialize());
  }

  private async downloadUpdate(
    modelName: string,
    meta: ModelVersionResponse,
    onSuccess: () => Promise<void>,
  ): Promise<boolean> {
    try {
      const res = await api.get(
        `/api/v1/models/${modelName}/${meta.version}.onnx`,
        { responseType: 'arraybuffer' },
      );
      const hash = await this._sha256(res.data);
      if (hash !== meta.checksum_sha256) return false;

      await EncryptedStorage.setItem(`${modelName}_version`, meta.version);
      await onSuccess();
      return true;
    } catch {
      return false;
    }
  }

  private async _sha256(buffer: ArrayBuffer): Promise<string> {
    const CryptoJS = await import('crypto-js');
    const wordArray = CryptoJS.lib.WordArray.create(buffer as any);
    return CryptoJS.SHA256(wordArray).toString(CryptoJS.enc.Hex);
  }
}

export const modelUpdater = new ModelUpdater();
