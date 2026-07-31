// jest.setupAfterEnv.js - runs after the test framework is installed
import '@testing-library/jest-native/extend-expect';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';

let migrated = false;

beforeAll(async () => {
  if (migrated) return;
  migrated = true;
  try {
    const { getDb } = require('./src/db/connection');
    const migrations = require('./src/db/migrations/migrations').default;
    await migrate(getDb(), migrations);
  } catch {}
});
