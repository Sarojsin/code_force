import { useEffect } from 'react';
import { wellnessClassifier } from 'src/services/ml/wellnessClassifier';
import { modelUpdater } from 'src/services/ml/modelUpdater';
import { logger } from 'src/utils';

export function useWellnessHydration() {
  useEffect(() => {
    wellnessClassifier.initialize().catch(() => {
      logger.warn('ONNX init failed, will use heuristic fallback');
    });
    modelUpdater.checkForUpdate().catch(() => {
      logger.warn('Model update check failed (offline or server error)');
    });
  }, []);
}
