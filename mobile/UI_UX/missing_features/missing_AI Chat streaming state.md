# Missing: AI Chat Streaming State

**Design Spec:** `mobile/UI_UX/AI_Chat.md` (line 78)
**Implemented File:** `mobile/src/screens/chat/AIChatScreen.tsx`

## Expected Behavior
- Typing indicator fades out
- Incremental words slide in (+2px Y) as they arrive
- Smooth streaming effect rather than bulk response

## Current Status
Not implemented. Responses appear all at once after a 1500ms delay.

## Implementation Notes
Implement SSE or chunked response handling. Use Reanimated to stagger word entrance animations. Replace the mock delay with a real streaming fetch.
