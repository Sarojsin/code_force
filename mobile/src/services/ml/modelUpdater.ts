import NetInfo from '@react-native-community/netinfo';
import { api } from 'src/services/api/client';
import { EncryptedStorage } from 'src/services/storage';
import { wellnessClassifier } from './wellnessClassifier';
import { ModelVersionResponse } from './wellnessTypes';

class ModelUpdater {
  async checkForUpdate(): Promise<boolean> {
    const netState = await NetInfo.fetch();
    if (!netState.isConnected || netState.type !== 'wifi') return false;

    const res = await api.get<ModelVersionResponse>('/api/v1/models/wellness-classifier/version');
    const remote = res.data;
    const local = await EncryptedStorage.getItem('wellness_model_version');
    if (remote.version === local) return false;
    return this.downloadUpdate(remote);
  }

  private async downloadUpdate(meta: ModelVersionResponse): Promise<boolean> {
    try {
      const res = await api.get(
        `/api/v1/models/wellness-classifier/${meta.version}.onnx`,
        { responseType: 'arraybuffer' },
      );
      const hash = await this._sha256(res.data);
      if (hash !== meta.checksum_sha256) return false;

      await EncryptedStorage.setItem('wellness_model_version', meta.version);
      await wellnessClassifier.initialize();
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
