# Implementation Plan 31: Consent and Privacy Management

## Objective
Implement user consent tracking and privacy controls per compliance requirements.

## Steps

### 31.1 Consent logging
- Record acceptance of privacy policy and AI analysis opt-in.
- Store consent version, timestamp, and IP hash.

### 31.2 Privacy controls
- Allow users to opt out of AI sentiment analysis.
- Allow users to disable data sharing with family members.

### 31.3 Data export
- Endpoint for users to download their data (GDPR right to portability).
- Include journals, cycle entries, mood logs.

## Validation Criteria
- Consent records created on policy acceptance.
- Opt-out prevents background analysis tasks.
- Data export returns complete user dataset.
