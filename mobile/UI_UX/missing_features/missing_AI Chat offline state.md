# Missing: AI Chat Offline State

**Design Spec:** `mobile/UI_UX/AI_Chat.md` (line 79)
**Implemented File:** `mobile/src/screens/chat/AIChatScreen.tsx`

## Expected Behavior
- Input remains enabled while offline
- Mauve banner displayed: "Offline mode..."
- Queue messages for when connection resumes

## Current Status
Not implemented. No offline handling in the chat screen.

## Implementation Notes
Use NetInfo to detect connectivity. Show a persistent banner when offline. Queue outgoing messages in AsyncStorage and send them on reconnect.
