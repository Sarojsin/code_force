import { healthMetricsLocalService } from '../localDb';
import { useCompanionStore } from '../../stores/companionStore';

export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  condition: (metrics: UserMetrics) => boolean;
}

export interface UserMetrics {
  sleepStreak: number;
  waterStreak: number;
  foodStreak: number;
  exerciseStreak: number;
  medicationStreak: number;
}

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: 'sleep_streak_7',
    name: 'Sleep Streak',
    description: 'Log sleep for 7 consecutive days',
    icon: '\u{1F319}',
    condition: (u) => u.sleepStreak >= 7,
  },
  {
    id: 'sleep_streak_30',
    name: 'Sleep Master',
    description: 'Log sleep for 30 consecutive days',
    icon: '\u{1F31F}',
    condition: (u) => u.sleepStreak >= 30,
  },
  {
    id: 'hydration_hero_5',
    name: 'Hydration Hero',
    description: 'Drink 2L+ water for 5 consecutive days',
    icon: '\u{1F4A7}',
    condition: (u) => u.waterStreak >= 5,
  },
  {
    id: 'hydration_hero_30',
    name: 'Hydration Master',
    description: 'Drink 2L+ water for 30 consecutive days',
    icon: '\u{1F3C6}',
    condition: (u) => u.waterStreak >= 30,
  },
  {
    id: 'meal_tracker_10',
    name: 'Meal Tracker',
    description: 'Log 3 meals/day for 10 consecutive days',
    icon: '\u{1F957}',
    condition: (u) => u.foodStreak >= 10,
  },
  {
    id: 'movement_star_5',
    name: 'Movement Star',
    description: 'Log exercise for 5 consecutive days',
    icon: '\u{1F4AA}',
    condition: (u) => u.exerciseStreak >= 5,
  },
  {
    id: 'health_explorer_7',
    name: 'Health Explorer',
    description: 'Log all 5 metrics for 7 consecutive days',
    icon: '\u{1F4CA}',
    condition: (u) =>
      u.sleepStreak >= 7 &&
      u.waterStreak >= 7 &&
      u.foodStreak >= 7 &&
      u.exerciseStreak >= 7 &&
      u.medicationStreak >= 7,
  },
];

class AchievementEngine {
  async checkAchievements(
    userId: string,
    _triggerEvent?: string
  ): Promise<Achievement[]> {
    const metrics = await this.getUserMetrics(userId);
    const unlocked: Achievement[] = [];
    const storeState = useCompanionStore.getState();
    const existingAchievements: string[] =
      (storeState?.memory?.achievements as string[]) || [];

    for (const achievement of ACHIEVEMENTS) {
      if (existingAchievements.includes(achievement.id)) continue;
      if (achievement.condition(metrics)) {
        unlocked.push(achievement);
      }
    }
    return unlocked;
  }

  private async getUserMetrics(userId: string): Promise<UserMetrics> {
    const [sleepStreak, waterStreak, foodStreak, exerciseStreak, medicationStreak] =
      await Promise.all([
        healthMetricsLocalService.getStreak(userId, 'sleep'),
        healthMetricsLocalService.getStreak(userId, 'water'),
        healthMetricsLocalService.getStreak(userId, 'food'),
        healthMetricsLocalService.getStreak(userId, 'exercise'),
        healthMetricsLocalService.getStreak(userId, 'medication'),
      ]);
    return {
      sleepStreak,
      waterStreak,
      foodStreak,
      exerciseStreak,
      medicationStreak,
    };
  }
}

export const achievementEngine = new AchievementEngine();
