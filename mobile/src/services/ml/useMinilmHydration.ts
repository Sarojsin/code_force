import { useEffect, useState } from 'react';
import { minilmEmbedder } from './minilmEmbedder';
import { modelUpdater } from './modelUpdater';

export function useMinilmHydration() {
  const [ready, setReady] = useState(false);
  const [updated, setUpdated] = useState<{ wellness: boolean; minilm: boolean } | null>(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      await minilmEmbedder.initialize();
      if (mounted) setReady(true);
    }

    init();
  }, []);

  useEffect(() => {
    let mounted = true;

    async function checkUpdates() {
      const result = await modelUpdater.checkForUpdate();
      if (mounted) setUpdated(result);
    }

    checkUpdates();
  }, []);

  return { ready, updated };
}