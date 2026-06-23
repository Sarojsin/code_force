# Implementation Plan 28: Input Validation and Serialization

## Objective
Standardize request validation and response serialization across all endpoints.

## Steps

### 28.1 Pydantic schemas
- Separate Create, Update, and Response schemas for each resource.
- Use validators for phone numbers, dates, and enums.

### 28.2 Common validators
- Phone number format (E.164).
- Date range validators (DOB in past, due_date in future).
- Password strength if password auth is used.

### 28.3 Serialization
- Use orm_mode in Pydantic for SQLAlchemy models.
- Exclude sensitive fields (hashed_password, mfa_secret) from responses.

## Validation Criteria
- Invalid input returns 422 with clear errors.
- Response schemas exclude sensitive fields.
