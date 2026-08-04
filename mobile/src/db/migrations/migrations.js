// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo

import journal from './meta/_journal.json';
import m0000 from './0000_add_tables_v1.sql';
import m0001 from './0001_add_snooze_events.sql';
import m0002 from './0002_add_companion_metadata.sql';
import m0003 from './0003_add_health_metrics.sql';
import m0004 from './0004_add_cycle_type.sql';
import m0005 from './0005_add_diary_module.sql';
import m0006 from './0006_fix_diary_tables.sql';
import m0007 from './0007_add_diary_fts.sql';
import m0008 from './0008_add_day_observations.sql';

  export default {
    journal,
    migrations: {
      m0000,
m0001,
m0002,
m0003,
m0004,
m0005,
m0006,
      m0007,
m0008
    }
  }
  