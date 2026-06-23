# Implementation Plan 23: Pagination, Filtering, and Query Optimization

## Objective
Standardize pagination, filtering, and efficient query patterns across endpoints.

## Steps

### 23.1 Pagination helpers
- Cursor-based pagination for large datasets (journals, logs).
- Offset-based pagination for admin lists with page/limit params.

### 23.2 Filtering
- Reusable query filter classes for date ranges, enums, and JSONB fields.
- Validate filter parameters before DB query.

### 23.3 Query optimization
- Use joinedload/selectinload to avoid N+1.
- Cover common queries with composite indexes.
- Use read replicas for heavy analytics queries.

## Validation Criteria
- Pagination returns correct total and items.
- Filters narrow results accurately.
- Slow query log shows no N+1.
