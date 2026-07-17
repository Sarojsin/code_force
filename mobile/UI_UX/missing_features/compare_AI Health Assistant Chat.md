# Compare: AI Health Assistant Chat

**Design Spec File:** `mobile/UI_UX/AI_Chat.md`
**Implemented File:** `mobile/src/screens/chat/AIChatScreen.tsx`

## Major Differences

| Spec Feature | Expected | Implemented | Status |
|-------------|----------|-------------|--------|
| Header | EB Garamond "SheCare AI Companion" + menu button (line 11) | Inter "SheCare AI" + voice button (line 157) | Different — no menu button, wrong subtitle |
| AI bubble background | Warm Cream #FFF8F0 (line 49) | Light gray #F5F5F5 (line 135) | Different |
| AI bubble border radius | 20px (top-left: 4px for tail) (line 52) | borderRadius: 20, borderTopLeftRadius: 4 (lines 135-136) | Implemented correctly |
| User bubble background | Soft Blush gradient (#FF6B8A → #FF5277) (line 49) | Solid theme.colors.primary (line 135) | Different — no gradient |
| User bubble border radius | 20px (top-right: 4px for tail) (line 52) | borderRadius: 20, borderTopRightRadius: 4 (line 135) | Implemented correctly |
| AI Avatar | 36px circle with leaf/flower icon in Lavender bg (line 54) | 32px circle with sparkle icon in accentMuted bg (lines 37, 271) | Different — wrong size, wrong icon, wrong background |
| Suggestion chips | Blush Light #FFB3C6 bg, Charcoal text, 12px rounded (line 59) | Surface bg with border, primary text, radius.pill (line 195) | Different — wrong colors |
| Input bar | 1px solid Mauve border, Off-White bg, 16px radius (line 63-64) | No border, surface bg, radius.pill (line 204-219) | Different — missing Mauve border |
| Send button | Small circular #FF6B8A with white arrow, active only with text (line 65) | 40×40 circle, primary color when active, border color when disabled (lines 236-241) | Partially implemented |
| Voice/mic button | Lavender #E8D5F5 circle, pulsating red ring when recording (line 66) | Solid accentMuted circle, static (line 161) | Missing recording animation |
| Medical disclaimer | Below initial AI message: "I'm AI-powered and not a substitute..." (line 69) | Appended to every AI response (line 105) | Different placement |
| Typing indicator | 3 Lavender #E8D5F5 dots cycling vertically with staggered spring bounce (line 73) | 3 gray dots cycling opacity (lines 47-78) | Different — wrong color, opacity animation instead of vertical bounce |
| Streaming state | Typing indicator fades out, incremental words slide in (+2px Y) (line 78) | Not implemented — responses appear all at once after 1500ms delay | Missing |
| Offline state | Input remains enabled, Mauve banner "Offline mode..." (line 79) | Not implemented | Missing |
| Error state | Friendly bubble "Oops!" with retry icon (line 80) | Not implemented | Missing |
| Floral SVG overlay | Delicate decorative floral in top-right corner (line 7) | Not implemented | Missing |

## Line-Specific Issues

- Line 26-33: Initial AI message appends disclaimer inline rather than showing it separately.
- Line 105: Disclaimer appended to every AI response with "\n\n⚕️ I'm AI-powered..." which bloats the messages.
- Line 222-231: Voice input button in the input bar is not functional — no recording action attached.
