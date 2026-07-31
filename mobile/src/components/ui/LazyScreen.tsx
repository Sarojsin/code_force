import React, { ComponentType, Suspense } from 'react';
import { ActivityIndicator, View } from 'react-native';

export function lazyScreen<T extends ComponentType<any>>(
  importFn: () => Promise<any>,
  exportName?: string,
): T {
  const LazyComponent = React.lazy(async () => {
    const mod = await importFn();
    return { default: exportName ? mod[exportName] : (mod.default || Object.values(mod)[0]) };
  });
  const Wrapped = (props: any) => (
    <Suspense
      fallback={
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="small" />
        </View>
      }
    >
      <LazyComponent {...props} />
    </Suspense>
  );
  Wrapped.displayName = `LazyScreen`;
  return Wrapped as unknown as T;
}
