# Implementation Plan 20: Documentation and Compliance

## Objective
Provide API docs, architecture decision records, and privacy compliance setup.

## Steps

### 20.1 API documentation
- FastAPI auto-generated Swagger at /docs.
- Export Postman collection for manual testing.

### 20.2 ADRs
- Document key decisions: external chat service, client-side encryption, queue choice.

### 20.3 Compliance
- Data retention policies (journals 2 years, SOS 90 days).
- User consent logging for privacy policy and AI opt-in.
- Third-party subprocessor disclosure.

### 20.4 README
- Setup, configuration, deployment, and contribution guide.

## Validation Criteria
- /docs renders with all endpoints documented.
- ADR template exists and first ADR is complete.
