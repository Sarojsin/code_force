import React, { ComponentType, Suspense } from 'react';

import { ScreenSkeleton } from './ScreenSkeleton';

/**
 * Singleton cache: keyed by `exportName` (a stable string) so the SAME screen
 * lazy-loaded from two navigators (e.g. `DiaryLibraryScreen` in both HomeStack
 * and WellnessStack) shares one component instance. Keying by `importFn.toString()`
 * is avoided because it changes when the file moves or the module is re-bundled.
 */
const cache = new Map<string, ComponentType<any>>();

export function lazyScreen<T extends ComponentType<any>>(
  importFn: () => Promise<any>,
  exportName?: string,
): T {
  const cacheKey = exportName ?? importFn.toString();

  const cached = cache.get(cacheKey);
  if (cached) {
    return cached as unknown as T;
  }

  const LazyComponent = React.lazy(async () => {
    const mod = await importFn();
    return { default: exportName ? mod[exportName] : (mod.default || Object.values(mod)[0]) };
  });
  const Wrapped = (props: any) => (
    <Suspense fallback={<ScreenSkeleton variant="list" count={4} label="Loading…" />}>
      {/* route.params flow through props; the singleton wrapper preserves them */}
      <LazyComponent {...props} />
    </Suspense>
  );
  Wrapped.displayName = `LazyScreen(${exportName ?? 'module'})`;
  cache.set(cacheKey, Wrapped);
  return Wrapped as unknown as T;
}