# AI Health Assistant Chat — Material + Minimal

> Route: `MainTabs` → `AI Chat` tab (4th tab)

## Layout

Full-screen chat interface with a professional healthcare AI assistant.

```
┌─────────────────────────────────────┐
│  ◀ SheCare AI                🎤    │  <- Header with back + voice button
├─────────────────────────────────────┤
│  ┌─────────────────────┐            │
│  │  Hello! I'm your    │            │
│  │  health assistant.  │            │  <- AI message (left aligned)
│  │  How can I help     │            │
│  │  you today?         │            │
│  │         10:30 AM    │            │
│  └─────────────────────┘            │
│            ┌───────────────────┐    │
│            │ What's today's    │    │  <- User message (right aligned)
│            │ horoscope?        │    │
│            │          10:31 AM │    │
│            └───────────────────┘    │
│  ┌─────────────────────────────────┐│
│  │ 🤖 I can help with period      ││
│  │ tracking, symptoms, and        ││  <- AI response with medical
│  │ health questions. Remember     ││  disclaimer
│  │ that I'm not a doctor —        ││
│  │ consult a healthcare           ││
│  │ professional for medical       ││
│  │ advice.                        ││
│  │                   10:31 AM     ││
│  └─────────────────────────────────┘│
│                                     │
│  [Suggestion Chip] [Suggestion Chip]│  <- Quick action chips
│  [Suggestion Chip] [Suggestion Chip]│
├─────────────────────────────────────┤
│  ┌───────────────────────────┐ [🎤] │  <- Input bar
│  │ Type a message...         │      │
│  └───────────────────────────┴──────┤
└─────────────────────────────────────┘
```

## Chat Bubble Specs

| Property | AI Bubble | User Bubble |
|----------|-----------|-------------|
| Alignment | Left | Right |
| Background | `#F5F5F5` (light) / white | Brand primary `#FF5C8A` |
| Text color | Text primary | White |
| Max width | 80% | 80% |
| Border radius | 20px (top-left: 4px) | 20px (top-right: 4px) |
| Shadow | Soft (sm) | None |
| Avatar | AI avatar icon (left) | User initial (right, hidden if same user) |

## AI Avatar

- Custom illustration: friendly flower/leaf icon in accent purple circle
- Shown on first AI message of each group
- Size: 36×36px

## Features

### Suggestion Chips
- Scrollable horizontal list above input bar
- Predefined prompts: "Track my period", "Log a symptom", "Cycle education", "Feeling anxious"
- Tapping a chip sends it as a user message and triggers AI response
- Dynamic: chips change based on conversation context

### Voice Input Button
- Microphone icon button next to text input
- Uses Expo Speech / react-native-voice
- While recording: button pulses with red dot
- On complete: transcribed text appears in input bar

### Typing Indicator
- Animated bouncing dots (3 dots, staggered animation)
- Shown while waiting for AI response
- Replaced with "disclaimer" text on first response: "AI-generated, not medical advice"

### Message Timestamps
- Show on alternating messages or grouped bubbles
- Format: "10:30 AM"
- Date separators: "Today", "Yesterday", "Monday, Sep 15"

## Input Bar

- Rounded pill shape (pill radius)
- Text input + send button (brand primary) + voice button (accent purple)
- Send button disabled when input empty
- Max 4 lines, scrollable

## Quick Actions (Header)

Header menu (three dots) with:
- Clear conversation
- Export chat (PDF)
- FAQ
- About AI assistant

## States

| State | Behavior |
|-------|----------|
| **Loading history** | Skeleton bubbles (2-3) |
| **First visit** | AI greeting message + suggestions |
| **Streaming response** | Typing indicator → incremental text reveal |
| **Error** | "Something went wrong" bubble + retry button |
| **Offline** | Banner: "AI unavailable offline. Your message will be sent when connected." + message queued |
| **Empty** | AI greeting + full suggestion chip set |

## Medical Disclaimer

Every AI response must end with or include:
> ⚕️ I'm AI-powered and not a substitute for professional medical advice.

Displayed as a subtle caption below the first AI message of each day.
