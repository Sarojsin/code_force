import { cycleService, GlobalModel } from 'src/services/api/cycle';
import { EncryptedStorage } from 'src/services/storage';

export interface LocalUserCycleData {
  avgCycle: number;
  avgError?: number;
  trendSlope?: number;
  stressLevel?: 'low' | 'moderate' | 'high';
  ageBucketOrdinal?: number;
  bmiBucketOrdinal?: number;
  localCorrectionDelta?: number;
}

function calculatePrediction(userData: LocalUserCycleData, model: GlobalModel): number {
  const coef = model.coefficients;
  const scaler = model.scaler;

  let prediction = coef.intercept || 28;

  const normAvg = (userData.avgCycle - (scaler.avg_cycle_mean || 29))
    / Math.max(scaler.avg_cycle_std || 4, 0.01);
  prediction += (coef.avg_cycle || 0) * normAvg;
  prediction += (coef.bmi_bucket || 0) * (userData.bmiBucketOrdinal || 0);
  prediction += (coef.age_bucket || 0) * (userData.ageBucketOrdinal || 0);

  if (userData.trendSlope !== undefined) {
    prediction += (coef.trend_slope || 0) * userData.trendSlope;
  }
  if (userData.avgError !== undefined) {
    prediction += (coef.error_correction || 0) * userData.avgError;
  }

  if (userData.stressLevel === 'high') {
    prediction += coef.stress_high || 0;
  } else if (userData.stressLevel === 'moderate') {
    prediction += coef.stress_moderate || 0;
  }

  const now = new Date();
  prediction += (coef.month_sin || 0) * Math.sin(2 * Math.PI * now.getMonth() / 12);
  prediction += (coef.month_cos || 0) * Math.cos(2 * Math.PI * now.getMonth() / 12);
  prediction += (coef.luteal_length || 0) * (userData.avgCycle - 14);
  prediction += userData.localCorrectionDelta || 0;

  return Math.min(45, Math.max(20, Math.round(prediction)));
}

const MODEL_CACHE_KEY = 'global_model_json';
const MODEL_VERSION_KEY = 'global_model_version';

class GlobalModelClient {
  private cached: GlobalModel | null = null;

  async ensureLatest(): Promise<GlobalModel> {
    const status = await cycleService.getModelStatus();
    const cachedVersion = await EncryptedStorage.getItem(MODEL_VERSION_KEY);

    if (cachedVersion && parseInt(cachedVersion, 10) === status.current_version) {
      const cachedJson = await EncryptedStorage.getItem(MODEL_CACHE_KEY);
      if (cachedJson) {
        try {
          const model: GlobalModel = JSON.parse(cachedJson);
          if (model.version === status.current_version) {
            this.cached = model;
            return this.cached;
          }
        } catch {
          // cached data corrupt, re-download
        }
      }
    }

    try {
      const model = await cycleService.downloadModel(status.current_version);
      await EncryptedStorage.setItem(MODEL_CACHE_KEY, JSON.stringify(model));
      await EncryptedStorage.setItem(MODEL_VERSION_KEY, String(model.version));
      this.cached = model;
      return model;
    } catch (error) {
      console.warn('Global model download failed, using bundled fallback', error);
      const fallback = this._bundledFallback();
      this.cached = fallback;
      return fallback;
    }
  }

  private _bundledFallback(): GlobalModel {
    return {
      version: 0,
      trained_on: 'built-in',
      rmse: 4.5,
      mae: 3.8,
      feature_names: [],
      coefficients: { intercept: 28 },
      scaler: { avg_cycle_mean: 29, avg_cycle_std: 4 },
    };
  }

  predictNextCycle(userData: LocalUserCycleData): number {
    if (!this.cached) {
      return 28;
    }
    return calculatePrediction(userData, this.cached);
  }

  getCachedVersion(): number | null {
    return this.cached?.version ?? null;
  }
}

export const globalModelClient = new GlobalModelClient();
