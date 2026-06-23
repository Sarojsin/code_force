# Implementation Plan 7: Pregnancy Support Module

## Objective
Implement pregnancy profile, daily logs, milestones, and recommendations.

## Steps

### 7.1 Pregnancy profile
- POST/PUT /pregnancy/profile from LMP or due date.
- Compute current_week on read or via background job.
- One active pregnancy per user (unique constraint).

### 7.2 Daily logs
- POST /pregnancy/daily-log for symptoms, cravings, mood, notes.
- GET /pregnancy/daily-logs paginated by date range.
- Notes encrypted at rest.

### 7.3 Milestones
- Static table with week 1-42 data.
- GET /pregnancy/milestone returns current week entry.
- Medical disclaimer appended to tip text.

### 7.4 Recommendations
- GET /pregnancy/recommendations: rule-based diet/exercise tips by week.
- Future: integrate AI-based personalization.

### 7.5 End pregnancy
- DELETE /pregnancy/profile sets is_active=false and archives data.

## Validation Criteria
- Profile creates with correct week calculation.
- Daily logs persist and retrieve.
- Milestone lookup returns expected week.
- Recommendations change by trimester.
