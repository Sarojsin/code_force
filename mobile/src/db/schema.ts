import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Helper column builders
// ---------------------------------------------------------------------------
const isoDatetime = (name: string) => text(name).notNull();
const isoDatetimeOptional = (name: string) => text(name);
const isoDate = (name: string) => text(name).notNull();
const isoDateOptional = (name: string) => text(name);
const booleanCol = (name: string) => integer(name, { mode: 'boolean' });
const jsonCol = <T = any>(name: string) => text(name, { mode: 'json' }).$type<T>();

// ---------------------------------------------------------------------------
// 1. User Profiles
// ---------------------------------------------------------------------------
export const userProfiles = sqliteTable('user_profiles', {
  id: text('id').primaryKey(),
  email: text('email'),
  phone_number: text('phone_number'),
  display_name: text('display_name'),
  role: text('role', { enum: ['user', 'family', 'nurse', 'admin'] }).notNull(),
  is_active: booleanCol('is_active').notNull().default(true),
  is_verified: booleanCol('is_verified').notNull().default(false),
  provider: text('provider', { enum: ['local', 'google'] }).notNull().default('local'),
  onboarding_completed: booleanCol('onboarding_completed').notNull().default(false),
  created_at: isoDatetime('created_at'),
  last_login_at: isoDatetimeOptional('last_login_at'),
  synced_at: isoDatetime('synced_at'),
});

export type UserProfile = typeof userProfiles.$inferSelect;
export type NewUserProfile = typeof userProfiles.$inferInsert;

// ---------------------------------------------------------------------------
// 2. Onboarding Data
// ---------------------------------------------------------------------------
export const onboardingData = sqliteTable('onboarding_data', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull(),
  age: integer('age').notNull(),
  height_cm: integer('height_cm').notNull(),
  weight_kg: integer('weight_kg').notNull(),
  stress_level: text('stress_level', { enum: ['low', 'moderate', 'high'] }).notNull(),
  exercise_frequency: text('exercise_frequency', { enum: ['low', 'moderate', 'high'] }).notNull(),
  sleep_hours: integer('sleep_hours').notNull(),
  diet: text('diet', { enum: ['balanced', 'normal', 'junk'] }).notNull(),
  current_cycle_start: isoDate('current_cycle_start'),
  current_cycle_length: integer('current_cycle_length').notNull(),
  current_period_length: integer('current_period_length').notNull(),
  current_symptoms: jsonCol<string[]>('current_symptoms').notNull().default(sql`'[]'`),
  past_cycles: jsonCol<Array<{ cycle_start: string; cycle_length: number; period_length: number; symptoms: string[] }>>('past_cycles').notNull().default(sql`'[]'`),
  onboarding_completed: booleanCol('onboarding_completed').notNull().default(false),
  completed_at: isoDatetimeOptional('completed_at'),
  created_at: isoDatetime('created_at'),
  updated_at: isoDatetime('updated_at'),
  synced_at: isoDatetime('synced_at'),
});

export type OnboardingData = typeof onboardingData.$inferSelect;
export type NewOnboardingData = typeof onboardingData.$inferInsert;

// ---------------------------------------------------------------------------
// 3. Cycle Entries
// ---------------------------------------------------------------------------
export const cycleEntries = sqliteTable('cycle_entries', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull(),
  period_start_date: isoDate('period_start_date'),
  period_end_date: isoDateOptional('period_end_date'),
  flow_intensity: text('flow_intensity', { enum: ['light', 'medium', 'heavy', 'spotting'] }),
  symptoms: jsonCol<string[]>('symptoms').default(sql`'[]'`),
  mood_tags: jsonCol<string[]>('mood_tags').default(sql`'[]'`),
  energy_level: integer('energy_level'),
  notes: text('notes'),
  cycle_type: text('cycle_type').notNull().default('menstrual'),
  is_correction: booleanCol('is_correction').default(false),
  corrected_prediction_id: text('corrected_prediction_id'),
  created_at: isoDatetime('created_at'),
  updated_at: isoDatetime('updated_at'),
  is_active: booleanCol('is_active').notNull().default(true),
  deleted_at: isoDatetimeOptional('deleted_at'),
  synced_at: isoDatetime('synced_at'),
}, (table) => ({
  userIdIdx: index('idx_cycle_entries_user_id').on(table.user_id),
  periodStartIdx: index('idx_cycle_entries_period_start').on(table.period_start_date),
  syncedAtIdx: index('idx_cycle_entries_synced_at').on(table.synced_at),
}));

export type CycleEntry = typeof cycleEntries.$inferSelect;
export type NewCycleEntry = typeof cycleEntries.$inferInsert;

// ---------------------------------------------------------------------------
// 4. Journal Entries
// ---------------------------------------------------------------------------
export const journalEntries = sqliteTable('journal_entries', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull(),
  title: text('title'),
  content: text('content'),
  mood: text('mood'),
  sentiment_score: integer('sentiment_score'),
  sentiment_label: text('sentiment_label'),
  entry_date: isoDate('entry_date'),
  created_at: isoDatetime('created_at'),
  updated_at: isoDatetime('updated_at'),
  is_active: booleanCol('is_active').notNull().default(true),
  deleted_at: isoDatetimeOptional('deleted_at'),
  synced_at: isoDatetime('synced_at'),
}, (table) => ({
  userIdIdx: index('idx_journal_entries_user_id').on(table.user_id),
  entryDateIdx: index('idx_journal_entries_entry_date').on(table.entry_date),
}));

export type JournalEntry = typeof journalEntries.$inferSelect;
export type NewJournalEntry = typeof journalEntries.$inferInsert;

// ---------------------------------------------------------------------------
// 5. Mood Logs
// ---------------------------------------------------------------------------
export const moodLogs = sqliteTable('mood_logs', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull(),
  mood: text('mood').notNull(),
  intensity: integer('intensity').notNull(),
  notes: text('notes'),
  logged_at: isoDatetime('logged_at'),
  is_active: booleanCol('is_active').notNull().default(true),
  deleted_at: isoDatetimeOptional('deleted_at'),
  synced_at: isoDatetime('synced_at'),
}, (table) => ({
  userIdIdx: index('idx_mood_logs_user_id').on(table.user_id),
  loggedAtIdx: index('idx_mood_logs_logged_at').on(table.logged_at),
}));

export type MoodLog = typeof moodLogs.$inferSelect;
export type NewMoodLog = typeof moodLogs.$inferInsert;

// ---------------------------------------------------------------------------
// 6. Emergency Contacts
// ---------------------------------------------------------------------------
export const emergencyContacts = sqliteTable('emergency_contacts', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull(),
  name: text('name').notNull(),
  phone_number: text('phone_number').notNull(),
  relationship: text('relationship'),
  is_primary: booleanCol('is_primary').notNull().default(false),
  contact_user_id: text('contact_user_id'),
  contact_user_id_linked_at: isoDatetimeOptional('contact_user_id_linked_at'),
  is_active: booleanCol('is_active').notNull().default(true),
  deleted_at: isoDatetimeOptional('deleted_at'),
  synced_at: isoDatetime('synced_at'),
}, (table) => ({
  userIdIdx: index('idx_emergency_contacts_user_id').on(table.user_id),
}));

export type EmergencyContact = typeof emergencyContacts.$inferSelect;
export type NewEmergencyContact = typeof emergencyContacts.$inferInsert;

// ---------------------------------------------------------------------------
// 7. SOS Alerts
// ---------------------------------------------------------------------------
export const sosAlerts = sqliteTable('sos_alerts', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull(),
  triggered_at: isoDatetime('triggered_at'),
  latitude: integer('latitude').notNull(),
  longitude: integer('longitude').notNull(),
  location_accuracy_m: integer('location_accuracy_m'),
  sms_status: text('sms_status').notNull(),
  cancelled_at: isoDatetimeOptional('cancelled_at'),
  resolved_at: isoDatetimeOptional('resolved_at'),
  false_alarm: booleanCol('false_alarm').notNull().default(false),
  manual_intervention_needed: booleanCol('manual_intervention_needed').notNull().default(false),
  trigger_source: text('trigger_source'),
  is_active: booleanCol('is_active').notNull().default(true),
  deleted_at: isoDatetimeOptional('deleted_at'),
  synced_at: isoDatetime('synced_at'),
}, (table) => ({
  userIdIdx: index('idx_sos_alerts_user_id').on(table.user_id),
}));

export type SosAlert = typeof sosAlerts.$inferSelect;
export type NewSosAlert = typeof sosAlerts.$inferInsert;

// ---------------------------------------------------------------------------
// 8. Pregnancy Profile
// ---------------------------------------------------------------------------
export const pregnancyProfiles = sqliteTable('pregnancy_profiles', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull(),
  due_date: isoDateOptional('due_date'),
  weeks_pregnant: integer('weeks_pregnant').notNull(),
  trimester: integer('trimester').notNull(),
  baby_name: text('baby_name'),
  blood_type: text('blood_type'),
  allergies: jsonCol<string[]>('allergies'),
  created_at: isoDatetime('created_at'),
  updated_at: isoDatetime('updated_at'),
  synced_at: isoDatetime('synced_at'),
}, (table) => ({
  userIdIdx: index('idx_pregnancy_profiles_user_id').on(table.user_id),
}));

export type PregnancyProfile = typeof pregnancyProfiles.$inferSelect;
export type NewPregnancyProfile = typeof pregnancyProfiles.$inferInsert;

// ---------------------------------------------------------------------------
// 9. Pregnancy Daily Logs
// ---------------------------------------------------------------------------
export const pregnancyDailyLogs = sqliteTable('pregnancy_daily_logs', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull(),
  date: isoDate('date'),
  symptoms: jsonCol<Record<string, unknown>>('symptoms'),
  mood: text('mood'),
  weight_kg: integer('weight_kg'),
  blood_pressure_systolic: integer('blood_pressure_systolic'),
  blood_pressure_diastolic: integer('blood_pressure_diastolic'),
  notes: text('notes'),
  synced_at: isoDatetime('synced_at'),
}, (table) => ({
  userIdIdx: index('idx_pregnancy_daily_logs_user_id').on(table.user_id),
}));

export type PregnancyDailyLog = typeof pregnancyDailyLogs.$inferSelect;
export type NewPregnancyDailyLog = typeof pregnancyDailyLogs.$inferInsert;

// ---------------------------------------------------------------------------
// 10. Pregnancy Milestones
// ---------------------------------------------------------------------------
export const pregnancyMilestones = sqliteTable('pregnancy_milestones', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull(),
  week: integer('week').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  category: text('category').notNull(),
  is_completed: booleanCol('is_completed').notNull().default(false),
  completed_at: isoDatetimeOptional('completed_at'),
  synced_at: isoDatetime('synced_at'),
}, (table) => ({
  userIdIdx: index('idx_pregnancy_milestones_user_id').on(table.user_id),
}));

export type PregnancyMilestone = typeof pregnancyMilestones.$inferSelect;
export type NewPregnancyMilestone = typeof pregnancyMilestones.$inferInsert;

// ---------------------------------------------------------------------------
// 11. Pregnancy Recommendations
// ---------------------------------------------------------------------------
export const pregnancyRecommendations = sqliteTable('pregnancy_recommendations', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull(),
  week: integer('week').notNull(),
  category: text('category').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  priority: text('priority', { enum: ['low', 'medium', 'high'] }).notNull(),
  synced_at: isoDatetime('synced_at'),
}, (table) => ({
  userIdIdx: index('idx_pregnancy_recommendations_user_id').on(table.user_id),
}));

export type PregnancyRecommendation = typeof pregnancyRecommendations.$inferSelect;
export type NewPregnancyRecommendation = typeof pregnancyRecommendations.$inferInsert;

// ---------------------------------------------------------------------------
// 12. Family Links
// ---------------------------------------------------------------------------
export const familyLinks = sqliteTable('family_links', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull(),
  linked_user_id: text('linked_user_id'),
  status: text('status').notNull(),
  permissions: jsonCol<string[]>('permissions').notNull().default(sql`'[]'`),
  created_at: isoDatetime('created_at'),
  is_active: booleanCol('is_active').notNull().default(true),
  deleted_at: isoDatetimeOptional('deleted_at'),
  synced_at: isoDatetime('synced_at'),
}, (table) => ({
  userIdIdx: index('idx_family_links_user_id').on(table.user_id),
}));

export type FamilyLink = typeof familyLinks.$inferSelect;
export type NewFamilyLink = typeof familyLinks.$inferInsert;

// ---------------------------------------------------------------------------
// 13. Chat Rooms
// ---------------------------------------------------------------------------
export const chatRooms = sqliteTable('chat_rooms', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull(),
  name: text('name').notNull(),
  participant_count: integer('participant_count').notNull().default(0),
  last_message: text('last_message'),
  last_message_at: isoDatetimeOptional('last_message_at'),
  unread_count: integer('unread_count').notNull().default(0),
  synced_at: isoDatetime('synced_at'),
});

export type ChatRoom = typeof chatRooms.$inferSelect;
export type NewChatRoom = typeof chatRooms.$inferInsert;

// ---------------------------------------------------------------------------
// 14. Nurse Content
// ---------------------------------------------------------------------------
export const nurseContents = sqliteTable('nurse_contents', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  category: text('category').notNull(),
  tags: jsonCol<string[]>('tags'),
  body: text('body'),
  references: jsonCol<string[]>('references'),
  published_at: isoDatetime('published_at'),
  updated_at: isoDatetimeOptional('updated_at'),
  synced_at: isoDatetime('synced_at'),
});

export type NurseContent = typeof nurseContents.$inferSelect;
export type NewNurseContent = typeof nurseContents.$inferInsert;

// ---------------------------------------------------------------------------
// 15. Feature Flags
// ---------------------------------------------------------------------------
export const featureFlags = sqliteTable('feature_flags', {
  key: text('key').primaryKey(),
  value: booleanCol('value').notNull().default(false),
  synced_at: isoDatetime('synced_at'),
});

export type FeatureFlag = typeof featureFlags.$inferSelect;
export type NewFeatureFlag = typeof featureFlags.$inferInsert;

// ---------------------------------------------------------------------------
// 16. Health Insights
// ---------------------------------------------------------------------------
export const healthInsights = sqliteTable('health_insights', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull(),
  total_journal_entries: integer('total_journal_entries').notNull().default(0),
  total_mood_logs: integer('total_mood_logs').notNull().default(0),
  average_mood_intensity: integer('average_mood_intensity'),
  most_common_mood: text('most_common_mood'),
  recommendation: text('recommendation'),
  synced_at: isoDatetime('synced_at'),
}, (table) => ({
  userIdIdx: index('idx_health_insights_user_id').on(table.user_id),
}));

export type HealthInsight = typeof healthInsights.$inferSelect;
export type NewHealthInsight = typeof healthInsights.$inferInsert;

// ---------------------------------------------------------------------------
// 17. Predictions
// ---------------------------------------------------------------------------
export const predictions = sqliteTable('predictions', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull(),
  predicted_next_period_start: isoDate('predicted_next_period_start'),
  predicted_period_end: isoDateOptional('predicted_period_end'),
  predicted_fertile_window_start: isoDateOptional('predicted_fertile_window_start'),
  predicted_fertile_window_end: isoDateOptional('predicted_fertile_window_end'),
  model_type: text('model_type').notNull(),
  confidence_score: integer('confidence_score'),
  confidence_label: text('confidence_label'),
  training_data_points: integer('training_data_points').notNull().default(0),
  prediction_window_days: integer('prediction_window_days'),
  synced_at: isoDatetime('synced_at'),
}, (table) => ({
  userIdIdx: index('idx_predictions_user_id').on(table.user_id),
}));

export type Prediction = typeof predictions.$inferSelect;
export type NewPrediction = typeof predictions.$inferInsert;

// ---------------------------------------------------------------------------
// 18. Snooze Events
// ---------------------------------------------------------------------------
export const snoozeEvents = sqliteTable('snooze_events', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull(),
  predicted_cycle_id: text('predicted_cycle_id').notNull(),
  snoozed_at: isoDatetime('snoozed_at'),
  day_offset: integer('day_offset').notNull(),
  created_at: isoDatetime('created_at'),
  updated_at: isoDatetime('updated_at'),
  synced_at: isoDatetime('synced_at'),
}, (table) => ({
  userIdIdx: index('idx_snooze_events_user_id').on(table.user_id),
  predictedCycleIdIdx: index('idx_snooze_events_predicted_cycle_id').on(table.predicted_cycle_id),
}));

export type SnoozeEvent = typeof snoozeEvents.$inferSelect;
export type NewSnoozeEvent = typeof snoozeEvents.$inferInsert;

// ---------------------------------------------------------------------------
// 19. Sync Log (audit trail)
// ---------------------------------------------------------------------------
export const syncLog = sqliteTable('sync_log', {
  id: text('id').primaryKey(),
  user_id: text('user_id').notNull(),
  direction: text('direction', { enum: ['push', 'pull'] }).notNull(),
  status: text('status', { enum: ['success', 'partial', 'failed'] }).notNull(),
  operations_count: integer('operations_count').notNull().default(0),
  conflicts_count: integer('conflicts_count').notNull().default(0),
  errors_count: integer('errors_count').notNull().default(0),
  started_at: isoDatetime('started_at'),
  completed_at: isoDatetimeOptional('completed_at'),
  synced_at: isoDatetime('synced_at'),
}, (table) => ({
  userIdIdx: index('idx_sync_log_user_id').on(table.user_id),
}));

export type SyncLog = typeof syncLog.$inferSelect;
export type NewSyncLog = typeof syncLog.$inferInsert;
