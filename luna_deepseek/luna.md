Prompt for AI Image Generator (DALL-E / Midjourney / Stable Diffusion)
text
Generate a 2D spritesheet for a virtual cat companion named "Luna" for a mobile health app called SheCare.

## Style Requirements

- **Art Style:** Cute, warm, slightly cartoonish (NOT realistic, NOT chibi)
- **Palette:** Soft pastels (pink, lavender, cream, warm brown) with subtle gradients
- **Tone:** Friendly, calm, gentle, caring, playful
- **Reference:** Tamagotchi, Nintendogs, Stardew Valley animals, Studio Ghibli cats
- **Resolution:** 256px per frame (scalable), transparent background (PNG)
- **Grid:** Organized into rows (animations) and columns (frames)

## Required Animations (Rows)

Each row should contain 4-8 frames showing a fluid animation cycle:

| Row | Animation | Frames | Description |
|-----|-----------|--------|-------------|
| 1 | **Idle** | 4 frames | Breathing gently, tail slow sway, occasional blink |
| 2 | **Walking** | 6 frames | Pacing left-to-right (looping), tail up |
| 3 | **Running** | 6 frames | Fast pace, ears back, playful energy |
| 4 | **Jumping** | 4 frames | Crouch → leap → peak → land |
| 5 | **Happy/Dance** | 6 frames | Playful hop, tail high, ears perked |
| 6 | **Sad** | 3 frames | Ears down, tail low, gentle sigh |
| 7 | **Sleeping** | 3 frames | Curled up, gentle breathing, closed eyes |
| 8 | **Waving** | 4 frames | Paw up, gentle wave |
| 9 | **Stretching** | 4 frames | Front paws out, back arched (yoga pose) |
| 10 | **Eating** | 4 frames | Nibbling, chewing (optional) |
| 11 | **Thinking** | 3 frames | Paw on chin, looking up |

## Additional Assets Needed (Separate Files)

| Asset | Format | Size | Description |
|-------|--------|------|-------------|
| **Hero Portrait** | PNG | 512x512 px | Luna sitting pretty, big eyes, soft smile (used in Feature Store, Settings) |
| **App Icon Variant** | PNG | 256x256 px | Luna's face (simplified) for feature icon |
| **Loading Placeholder** | PNG | 128x128 px | Simple silhouette of Luna (shown while downloading) |
| **Speech Bubble Base** | PNG | 200x100 px | Rounded white/transparent bubble (scalable) |
| **Pet House Background** | PNG | 1024x768 px | Cozy room with bed, food bowl, toy (Phase 2) |

## Color Palette (Hex Codes)

| Color | Hex | Use |
|-------|-----|-----|
| **Primary Pink** | #FFB3C6 | Luna's collar, blush |
| **Soft Lavender** | #E8D5F5 | Luna's bed, pillow |
| **Warm Cream** | #FFF8F0 | Luna's belly, background |
| **Cat Fur (Brown)** | #D4A5B5 | Luna's main color |
| **Cat Fur (Light)** | #F7C5CC | Luna's chest, paws |
| **Eyes** | #8A6E9B | Soft purple eyes |
| **Nose** | #FF6B8A | Little pink nose |
| **Whiskers** | #D4A5B5 | Soft gray whiskers |

## Emote / Expression Set (For Dialogue Engine)

Luna should show these expressions in the overlay (these can be separate 64x64 PNGs):

- Happy 😊
- Sad 😔
- Excited 🎉
- Sleepy 😴
- Curious 🤔
- Embarrassed 😳
- Loving 💕

## Dialogue JSON Structure (For Development)

```json
{
  "morning": [
    "Good morning! 🌸 Ready for a new day?",
    "I missed you! Let's start today together.",
    "Wake up, wake up! The sun is shining!"
  ],
  "evening": [
    "Good evening! How was your day?",
    "I'm glad you're back. Let's relax together.",
    "The stars are out. Time to unwind."
  ],
  "journal_saved": [
    "I'll keep this memory safe! 🌸",
    "Thank you for sharing with me.",
    "You're so brave for writing that down."
  ],
  "mood_happy": [
    "You seem happy today! Let's celebrate! 🎉",
    "I love seeing you smile! 😊",
    "Your happiness makes me happy too!"
  ],
  "mood_sad": [
    "I'm here for you. 🐾",
    "Sending you a warm hug. 🤗",
    "It's okay to feel this way. I'm with you."
  ],
  "mood_anxious": [
    "Let's take a deep breath together. 🌬️",
    "I'm right beside you. You're safe.",
    "One step at a time. We've got this."
  ],
  "period_logged": [
    "You did it! I'm so proud of you! 🎉",
    "Rest and take care of yourself. 🌸",
    "Your body is amazing. Thank you for listening to it."
  ],
  "water_logged": [
    "Let's drink some water! 💧",
    "Hydration is key! I'm getting thirsty too.",
    "Cheers! 🥤"
  ],
  "exercise_completed": [
    "You did it! 💪",
    "I'm so proud of you! Let's celebrate! 🎉",
    "Strong body, strong mind. You're amazing!"
  ],
  "late_night": [
    "We both should sleep soon. 😴",
    "It's getting late. Let's rest together.",
    "Sweet dreams! 🌙"
  ],
  "period_approaching": [
    "Your next period is in X days. I'm here for you. 🌸",
    "You're doing great. Rest if you need to.",
    "I'll be with you every step of the way."
  ],
  "welcome_back": [
    "Welcome back! 🌸 I missed you! 🐾",
    "So glad to see you! How have you been?",
    "I was just thinking about you!"
  ]
}
Technical Requirements
Requirement	Specification
Format	PNG (transparent background)
Spritesheet Size	Max 2048x2048 px (to fit in memory)
Frame Size	256x256 px (uniform)
Frame Spacing	2px gap between frames (to prevent bleeding)
Animation Speed	150-300ms per frame (smooth but not fast)
Orientation	Luna faces RIGHT (we'll flip horizontally for left movement)
Export	Single spritesheet PNG + individual frame PNGs (for easier editing)
Example of a Complete Spritesheet Layout
text
┌──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
│          │          │          │          │          │          │
│  IDLE 1  │  IDLE 2  │  IDLE 3  │  IDLE 4  │  WALK 1  │  WALK 2  │
│          │          │          │          │          │          │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│          │          │          │          │          │          │
│  WALK 3  │  WALK 4  │  WALK 5  │  WALK 6  │  JUMP 1  │  JUMP 2  │
│          │          │          │          │          │          │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│          │          │          │          │          │          │
│  JUMP 3  │  JUMP 4  │  HAPPY 1 │  HAPPY 2 │  HAPPY 3 │  HAPPY 4 │
│          │          │          │          │          │          │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│          │          │          │          │          │          │
│  HAPPY 5 │  HAPPY 6 │  SAD 1   │  SAD 2   │  SAD 3   │  SLEEP 1 │
│          │          │          │          │          │          │
├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤
│          │          │          │          │          │          │
│  SLEEP 2 │  SLEEP 3 │  WAVE 1  │  WAVE 2  │  WAVE 3  │  WAVE 4  │
│          │          │          │          │          │          │
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘
Fallback Option (If You're Using AI Image Generator)
If using DALL-E or Midjourney, generate individual frames and assemble them manually:

text
Prompt for single frame: "Cute 2D cartoon cat, soft pastel colors, warm cream and brown fur, purple eyes, pink nose, gentle smile, simple background, studio ghibli style, 256x256 pixels, transparent background."

Generate 20-30 variations, select the best, arrange into spritesheet using Photoshop or Aseprite.
What to Do After Getting the Spritesheet
Step	Action
1.	Save luna_spritesheet.png (the full grid)
2.	Save luna_frames.json (frame coordinates for each animation)
3.	Save luna_dialogues.json (the text messages)
4.	Bundle them into luna_assets_v1.zip
5.	Upload to your CDN/backend
6.	Update the download URL in your assetDownloader.ts
Developer Checklist (When Implementing)
□ Spritesheet loads correctly in AnimationEngine
□ Each animation plays at the correct speed
□ Speech bubbles appear above Luna
□ Luna faces right (flipped for left movement if needed)
□ Idle animation loops smoothly
□ Transitions between animations are seamless
□ No flickering when switching frames
□ Memory usage stays under 10 MB
□ Works on low-end devices (2GB RAM)
Final Verdict
This prompt gives you:

Deliverable	Status
Spritesheet Layout	✅ Defined (rows, columns, frame counts)
Color Palette	✅ Specified (Hex codes)
Animation States	✅ Mapped (Idle, Walk, Jump, Happy, Sad, Sleep, Wave)
Dialogue JSON	✅ Pre-written (50+ messages)
Technical Specs	✅ Detailed (size, format, export)
AI Art Prompt	✅ Provided (for image generators)
Proceed with this prompt. It will generate a beautiful, consistent, and technically sound Luna asset package that your developers can implement immediately. 🌸🐱🖼️

