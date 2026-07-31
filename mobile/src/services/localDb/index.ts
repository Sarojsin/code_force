import { CycleLocalService } from './CycleLocalService';
import { JournalLocalService } from './JournalLocalService';
import { MoodLocalService } from './MoodLocalService';
import { EmergencyContactLocalService } from './EmergencyContactLocalService';
import { SosAlertLocalService } from './SosAlertLocalService';
import { PregnancyProfileLocalService } from './PregnancyProfileLocalService';
import { PregnancyMilestoneLocalService } from './PregnancyMilestoneLocalService';
import { FamilyLinkLocalService } from './FamilyLinkLocalService';
import { HealthInsightLocalService } from './HealthInsightLocalService';
import { FeatureFlagLocalService } from './FeatureFlagLocalService';
import { SnoozeLocalService } from './SnoozeLocalService';
import { DiaryLocalService } from './DiaryLocalService';
import { DiaryPageLocalService } from './DiaryPageLocalService';
import { DiaryPageObjectLocalService } from './DiaryPageObjectLocalService';
import { DiaryMediaLocalService } from './DiaryMediaLocalService';
import { DiarySearchLocalService } from './DiarySearchLocalService';
import { DiarySyncService } from './DiarySyncService';

export { CompanionLocalService, companionLocalService, calculateLevel } from './CompanionLocalService';
export { HealthMetricsLocalService, healthMetricsLocalService } from './HealthMetricsLocalService';
export { DiaryLocalService } from './DiaryLocalService';
export { DiaryPageLocalService } from './DiaryPageLocalService';
export { DiaryPageObjectLocalService } from './DiaryPageObjectLocalService';
export { DiaryMediaLocalService } from './DiaryMediaLocalService';
export { DiarySearchLocalService } from './DiarySearchLocalService';
export { DiarySyncService } from './DiarySyncService';
export { DiaryAssetLocalService, diaryAssetLocalService } from './DiaryAssetLocalService';

export const diaryLocal = {
  diary: new DiaryLocalService(),
  page: new DiaryPageLocalService(),
  object: new DiaryPageObjectLocalService(),
  media: new DiaryMediaLocalService(),
  search: new DiarySearchLocalService(),
  sync: new DiarySyncService(),
};

export const localDb = {
  cycle: new CycleLocalService(),
  journal: new JournalLocalService(),
  mood: new MoodLocalService(),
  emergencyContact: new EmergencyContactLocalService(),
  sosAlert: new SosAlertLocalService(),
  pregnancyProfile: new PregnancyProfileLocalService(),
  pregnancyMilestone: new PregnancyMilestoneLocalService(),
  familyLink: new FamilyLinkLocalService(),
  healthInsight: new HealthInsightLocalService(),
  featureFlag: new FeatureFlagLocalService(),
  snoozeEvent: new SnoozeLocalService(),
} as const;

export type LocalDb = typeof localDb;
