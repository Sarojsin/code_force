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
} as const;

export type LocalDb = typeof localDb;
