# Implementation Plan 29: Testing Data Factories and Fixtures

## Objective
Create reusable test data factories and fixtures for consistent testing.

## Steps

### 29.1 Factory libraries
- Use factory_boy for model factories (User, CycleEntry, JournalEntry).
- Use Faker for realistic test data.

### 29.2 Fixtures
- Pytest fixtures for DB session, Redis, authenticated client.
- Fixtures for mocked Twilio, FCM, and Stream Chat.

### 29.3 Seed data
- Admin user, sample nurse, breathing exercises, pregnancy milestones.

## Validation Criteria
- Factories generate valid model instances.
- Tests use shared fixtures without duplication.
