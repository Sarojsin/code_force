import { BaseLocalService } from './BaseLocalService';
import { healthMetrics } from '../../db/schema';
import { eventBus } from '../eventBus';
import { generateUUID } from '../../utils/uuid';
import { and, eq, desc, sql, gte } from 'drizzle-orm';
import { getDb } from '../../db/connection';
import type { HealthMetric, NewHealthMetric } from '../../db/schema';
import { logger } from '../../utils';
import * as Sentry from '@sentry/react-native';

export type MetricType = 'sleep' | 'water' | 'food' | 'exercise' | 'medication';

export interface SleepValue {
  hours: number;
  quality?: 1 | 2 | 3 | 4 | 5;
}

export interface WaterValue {
  amount: number;
}

export interface FoodValue {
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  notes?: string;
}

export interface ExerciseValue {
  type: string;
  duration: number;
}

export interface MedicationValue {
  name: string;
  taken: boolean;
  dosage?: string;
}

export class HealthMetricsLocalService extends BaseLocalService<HealthMetric> {
  protected table = healthMetrics;
  protected tableName = 'health_metrics';

  async getToday(userId: string): Promise<HealthMetric[]> {
    const today = new Date().toISOString().split('T')[0];
    try {
      const db = getDb();
      return await db
        .select()
        .from(healthMetrics)
        .where(
          and(
            eq(healthMetrics.user_id, userId),
            sql`date(${healthMetrics.logged_at}) = ${today}`
          )
        )
        .orderBy(desc(healthMetrics.logged_at));
    } catch (error) {
      this.handleError('getToday', error);
      return [];
    }
  }

  async getByDateRange(
    userId: string,
    startDate: string,
    endDate: string
  ): Promise<HealthMetric[]> {
    try {
      const db = getDb();
      return await db
        .select()
        .from(healthMetrics)
        .where(
          and(
            eq(healthMetrics.user_id, userId),
            gte(healthMetrics.logged_at, startDate),
            sql`${healthMetrics.logged_at} <= ${endDate}`
          )
        )
        .orderBy(desc(healthMetrics.logged_at));
    } catch (error) {
      this.handleError('getByDateRange', error);
      return [];
    }
  }

  async logMetric(
    userId: string,
    type: MetricType,
    value: SleepValue | WaterValue | FoodValue | ExerciseValue | MedicationValue
  ): Promise<void> {
    try {
      const db = getDb();
      const entry: NewHealthMetric = {
        id: generateUUID(),
        user_id: userId,
        metric_type: type,
        value: JSON.stringify(value),
        logged_at: new Date().toISOString(),
      };
      await db.insert(healthMetrics).values(entry);

      eventBus.emit(`${type}_logged` as any, {
        userId,
        ...value,
      } as any);
    } catch (error) {
      this.handleError('logMetric', error);
    }
  }

  async getStreak(userId: string, metricType: MetricType): Promise<number> {
    try {
      const db = getDb();
      const rows = await db
        .select({ logged_at: healthMetrics.logged_at })
        .from(healthMetrics)
        .where(
          and(
            eq(healthMetrics.user_id, userId),
            eq(healthMetrics.metric_type, metricType)
          )
        )
        .orderBy(desc(healthMetrics.logged_at))
        .limit(365);

      let streak = 0;
      let expected = new Date();
      expected.setHours(0, 0, 0, 0);

      for (const row of rows) {
        const rowDate = new Date(row.logged_at);
        rowDate.setHours(0, 0, 0, 0);
        const diffMs = expected.getTime() - rowDate.getTime();
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
          continue;
        } else if (diffDays === 1) {
          streak++;
          expected = rowDate;
        } else if (diffDays > 1) {
          break;
        }
      }

      return streak;
    } catch {
      return 0;
    }
  }

  async getTodayCompletion(userId: string): Promise<{
    logged: MetricType[];
    total: number;
  }> {
    const today = await this.getToday(userId);
    const logged = new Set(today.map((r) => r.metric_type as MetricType));
    return {
      logged: Array.from(logged),
      total: 5,
    };
  }

  protected handleError(method: string, error: unknown): void {
    logger.error(`HealthMetricsLocalService.${method} failed`, error);
    Sentry.captureException(error, {
      tags: { service: 'HealthMetricsLocalService', method },
    });
  }
}

export const healthMetricsLocalService = new HealthMetricsLocalService();
