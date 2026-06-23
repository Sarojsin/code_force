# Implementation Plan 38: Data Seeding and Migration Scripts

## Objective
Provide scripts to seed reference data and assist with migrations.

## Steps

### 38.1 Seed data
- Breathing exercises (static content).
- Pregnancy milestones (week 1-42).
- Symptom and mood tag dictionaries.

### 38.2 Migration helpers
- Scripts to backfill encryption keys for existing users.
- Script to migrate from plaintext to encrypted fields.

### 38.3 Zero-downtime migrations
- Use expand/contract pattern for schema changes.
- Dual-write during transition periods.

## Validation Criteria
- Seed data loads without errors.
- Migration scripts complete on production-like data.
