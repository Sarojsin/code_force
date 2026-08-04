import { getDb } from '../../db/connection';
import { symptoms, medications } from '../../db/schema';
import type { Symptom, Medication } from '../../db/schema';
import type { SymptomMaster, MedicationMaster } from '../api/cycle';
import { eq } from 'drizzle-orm';
import { logger } from '../../utils';
import * as Sentry from '@sentry/react-native';

/**
 * Local SQLite service for the symptoms / medications master catalogs
 * (global — no user_id). Seeded on first launch from bundled JSON
 * (`src/assets/masters/*.json`) so the DayDetailSheet is fully functional
 * offline (DayDetailShee_plan.md §13.2); re-synced against the backend when
 * online.
 */

export interface BundledSymptom {
  id: string;
  name: string;
  category: string;
  icon?: string | null;
  display_order: number;
}

export interface BundledMedication {
  id: string;
  name: string;
  category: string;
  display_order: number;
}

export class DayMasterLocalService {
  async isSeeded(): Promise<boolean> {
    try {
      const db = getDb();
      const rows = await db.select({ id: symptoms.id }).from(symptoms).limit(1);
      return rows.length > 0;
    } catch (error) {
      this.handleError('isSeeded', error);
      return false;
    }
  }

  async ensureSeeded(): Promise<void> {
    try {
      if (await this.isSeeded()) return;
      const { symptomSeeds, medicationSeeds } = await this.loadBundledSeeds();
      await this.replaceAll(symptomSeeds, medicationSeeds);
      logger.info('Day masters seeded from bundle', {
        symptoms: symptomSeeds.length,
        medications: medicationSeeds.length,
      });
    } catch (error) {
      this.handleError('ensureSeeded', error);
    }
  }

  async replaceAll(
    symptomRows: BundledSymptom[],
    medicationRows: BundledMedication[],
  ): Promise<void> {
    try {
      const db = getDb();
      await db.transaction(async (tx) => {
        await tx.delete(symptoms);
        await tx.delete(medications);
        if (symptomRows.length > 0) {
          await tx.insert(symptoms).values(
            symptomRows.map((s) => ({
              id: s.id,
              name: s.name,
              category: s.category,
              icon: s.icon ?? null,
              display_order: s.display_order,
              synced_at: new Date().toISOString(),
            })),
          );
        }
        if (medicationRows.length > 0) {
          await tx.insert(medications).values(
            medicationRows.map((m) => ({
              id: m.id,
              name: m.name,
              category: m.category,
              display_order: m.display_order,
              synced_at: new Date().toISOString(),
            })),
          );
        }
      });
    } catch (error) {
      this.handleError('replaceAll', error);
    }
  }

  async listSymptoms(): Promise<SymptomMaster[]> {
    try {
      const db = getDb();
      const rows = await db
        .select()
        .from(symptoms)
        .orderBy(symptoms.display_order);
      return (rows as Symptom[]).map((s) => ({
        id: s.id,
        name: s.name,
        category: s.category,
        icon: s.icon ?? null,
        display_order: s.display_order,
      }));
    } catch (error) {
      this.handleError('listSymptoms', error);
      return [];
    }
  }

  async listMedications(): Promise<MedicationMaster[]> {
    try {
      const db = getDb();
      const rows = await db
        .select()
        .from(medications)
        .orderBy(medications.display_order);
      return (rows as Medication[]).map((m) => ({
        id: m.id,
        name: m.name,
        category: m.category,
        display_order: m.display_order,
      }));
    } catch (error) {
      this.handleError('listMedications', error);
      return [];
    }
  }

  async getSymptomByName(name: string): Promise<Symptom | null> {
    try {
      const db = getDb();
      const rows = await db.select().from(symptoms).where(eq(symptoms.name, name)).limit(1);
      return (rows as Symptom[])[0] ?? null;
    } catch (error) {
      this.handleError('getSymptomByName', error);
      return null;
    }
  }

  async getMedicationByName(name: string): Promise<Medication | null> {
    try {
      const db = getDb();
      const rows = await db.select().from(medications).where(eq(medications.name, name)).limit(1);
      return (rows as Medication[])[0] ?? null;
    } catch (error) {
      this.handleError('getMedicationByName', error);
      return null;
    }
  }

  private async loadBundledSeeds(): Promise<{
    symptomSeeds: BundledSymptom[];
    medicationSeeds: BundledMedication[];
  }> {
    const symptomsModule = await import('../../assets/masters/symptoms.json');
    const medicationsModule = await import('../../assets/masters/medications.json');
    return {
      symptomSeeds: (symptomsModule as { default: BundledSymptom[] }).default ?? [],
      medicationSeeds: (medicationsModule as { default: BundledMedication[] }).default ?? [],
    };
  }

  private handleError(method: string, error: unknown): void {
    const msg = error instanceof Error ? error.message : '';
    if (msg.includes('no such table')) {
      logger.warn('day_masters table not yet migrated — suppress error');
      return;
    }
    logger.error(`DayMasterLocalService.${method} failed`, error);
    Sentry.captureException(error, {
      tags: { service: 'DayMasterLocalService', method },
    });
  }
}