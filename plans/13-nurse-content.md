# Implementation Plan 10: Nurse Content Management

## Objective
Implement nurse profiles and educational content upload with admin approval workflow.

## Steps

### 10.1 Nurse profile
- Auto-create on role assignment.
- Admin endpoint to verify nurse (set verified_at).

### 10.2 Content upload
- POST /nurse/contents with presigned S3 URL.
- Store metadata: title, description, video_url, category, tags.
- Default status=pending.

### 10.3 Admin approval
- GET /admin/contents/pending lists unapproved content.
- PUT /admin/contents/{id}/approve sets status=approved and published_at.

### 10.4 Public content
- GET /contents paginated, filterable by category.
- Only approved content returned.

## Validation Criteria
- Nurse can create content in pending state.
- Admin approval makes it public.
- Unapproved content is excluded from public API.
