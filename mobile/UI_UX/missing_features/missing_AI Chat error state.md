# Missing: AI Chat Error State

**Design Spec:** `mobile/UI_UX/AI_Chat.md` (line 80)
**Implemented File:** `mobile/src/screens/chat/AIChatScreen.tsx`

## Expected Behavior
- Friendly bubble with "Oops!" text
- Retry icon to resend the failed message

## Current Status
Not implemented. No error UI for failed messages.

## Implementation Notes
Add error state to the message bubble component. Show a retry button that re-sends the message payload. Use the same bubble styling as AI responses but with an error color.
