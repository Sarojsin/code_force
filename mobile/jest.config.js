module.exports = {
  preset: '@react-native/jest-preset',

  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  moduleNameMapper: {
    '^src/(.*)$': '<rootDir>/src/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|@tanstack|@sentry|react-native-reanimated|react-native-gesture-handler|react-native-encrypted-storage|expo|expo-sqlite|drizzle-orm)/)',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/', '/e2e/'],
  testMatch: ['**/__tests__/**/*.test.{ts,tsx,js,jsx}', '**/?(*.)+(spec|test).{ts,tsx,js,jsx}'],
  collectCoverageFrom: [
    'src/services/sync/{isNetworkError,queryKeyMapper,syncEngine,useNetworkStatus,index,types}.ts',
    'src/stores/offlineStore.ts',
    'src/services/queries/{cycle,wellness,safety,index,offlineMutationWrapper,useNetworkAwareQuery}.ts',
    'src/services/safetySyncQueue.ts',
    'src/services/ml/{heuristicScorer,tokenizer,wellnessTypes}.ts',
    'src/validation/{auth,wellness}.ts',
    '!src/**/*.d.ts',
    '!src/types/**',
  ],
  coverageThreshold: {
    './src/services/sync/': {
      lines: 50,
      functions: 33,
      statements: 50,
      branches: 24,
    },
    './src/services/queries/': {
      lines: 60,
      functions: 50,
      statements: 60,
      branches: 35,
    },
    './src/stores/offlineStore.ts': {
      lines: 80,
      functions: 80,
      statements: 80,
      branches: 45,
    },
  },
};
