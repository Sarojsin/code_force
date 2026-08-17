 SHE CARE — COMPREHENSIVE PERFORMANCE AUDIT PROMPT (v1.0)
Goal: Identify all bottlenecks causing lag, slow response, and jank across the entire app.
Focus Areas: JS Thread (React), UI Thread (Native), Memory, 3D Rendering (Luna), Data Persistence, and Network.

1. JAVASCRIPT THREAD (React Rendering & Logic)
(The #1 cause of lag is unnecessary re-renders and heavy mount operations)

#	Checkpoint	How to Verify	Status
1.1	Are you using React.memo on heavy list items?	Check VideoLibraryScreen, DiaryTimeline, JournalList. If list items re-render when scrolling, FPS drops.	🟡
1.2	Are all inline functions memoized?	Search for onPress={() => ...} in the render method. Use useCallback for every handler passed to child components.	🔴
1.3	Are you using useMemo for expensive calculations?	Check expertRecommendations.ts & videoRecommendations.ts. Are you recalculating scores on every render? Wrap them in useMemo.	🟡
1.4	Are components splitting correctly?	Is the entire HomeDashboardScreen re-rendering when the cycleDay updates? Use React.Profiler to measure render times.	🔴
1.5	Are you using "Render Props" or "HOCs" excessively?	Check navigation stacks. Deeply nested HOCs can cause re-render cascades.	🟢
2. UI THREAD & FLAT LISTS (Native Rendering)
(Scrolling jank, slow navigation transitions)

#	Checkpoint	How to Verify	Status
2.1	Does VideoLibraryScreen use FlashList or optimized FlatList?	If using FlatList, ensure windowSize={10}, maxToRenderPerBatch={10}, removeClippedSubviews={true}, getItemLayout (if fixed height).	🔴
2.2	Are there heavy images in lists?	Ensure FastImage or expo-image is used for thumbnails (not standard <Image>). Lazy load off-screen images.	🟡
2.3	Does the Calendar Screen render 42+ days without virtualization?	Check Calendar.tsx. It renders a fixed grid. Ensure the grid items are pure and use renderItem efficiently.	🟡
2.4	Are there "zombie" animations running in the background?	Check LunaOverlay. Is the Reanimated useSharedValue loop still running when the app is in the background or on a different tab?	🔴
2.5	Are you using the useReducedMotion hook?	Does the app disable heavy parallax/animations on low-end devices?	🟢
3. LUNA (3D FILAMENT) SPECIFIC PERFORMANCE
(This is your heaviest component. Must be aggressively optimized.)

#	Checkpoint	How to Verify	Status
3.1	Is Filament rendering only when visible?	Check LunaOverlay. Is the 3D renderer unmounted or paused when the user navigates to Calendar/Analytics? (isFocused check).	🔴
3.2	What is the polygon count of cat.glb?	Open the model in Blender. High-poly models (e.g., > 10k triangles) will struggle on mid-range Android devices.	🟡
3.3	Is the model loaded from the filesystem (DLC) or bundled?	If DLC, loading is async. Is there a Skeleton placeholder so the UI doesn't freeze while loading the GLB?	🟢
3.4	Are you reducing draw calls?	Check if the 3D cat uses a single material/texture atlas. Multiple materials cause CPU spikes.	🟡
3.5	Is poseMapper.ts using pure math (no heavy objects)?	Ensure the pose calculation doesn't allocate new arrays/objects every frame (causes GC pauses).	🔴
4. STARTUP TIME & NAVIGATION
(Time to Interactive - TTI)

#	Checkpoint	How to Verify	Status
4.1	Are you doing heavy operations on mount (useEffect)?	Check JournalEntryScreen, HomeDashboardScreen. Move encryption/decryption or large DB queries to background threads or React Query (cache first).	🔴
4.2	Is Hermes enabled?	Check app.json. Is "jsEngine": "hermes" set for Android?	🔴
4.3	Are you using lazy loading for screens?	Check FeatureStacks.tsx. Use React.lazy() or LazyScreen component for heavy screens like Analytics/Diary.	🟡
4.4	Is the DLC (Luna 3D model) downloaded after the splash screen?	Do not block the entire app loading on downloading the 3D cat. Download in the background.	🟢
4.5	Are you pre-warming React Query?	Check AppProvider. Are you pre-fetching user prefs and basic cycle data before the Home screen renders?	🟡
5. NETWORK & DATABASE (Offline-First Bottlenecks)
#	Checkpoint	How to Verify	Status
5.1	Is the SQLite sync running on the UI thread?	Heavy localDb write operations should use runAsync (if available) or be batched to avoid blocking the JS thread.	🔴
5.2	Are you over-fetching?	Check useCycleEntries({ months_back: 12 }). Do you really need 12 months of data on the Home screen? Limit to 3 months.	🔴
5.3	Is React Query cache GC tuning set?	Default gcTime is 5 minutes. Frequent garbage collection of query caches can cause lag. Increase it to 10-15 mins for stable data.	🟡
5.4	Are you serializing/deserializing huge JSONs?	JSON parsing of large reports (Analytics AI report) is expensive. Use JSON.parse carefully and avoid parsing it multiple times.	🟡
6. MEMORY MANAGEMENT (Leaks)
#	Checkpoint	How to Verify	Status
6.1	Are there lingering setTimeout/setInterval in components?	Check AIChatScreen (if still present) and EventEngine. Are they cleaned up in useEffect cleanup functions?	🔴
6.2	Are Reanimated worklets properly disposed?	Check LunaOverlay and BreathingExerciseModal. If the component unmounts while an animation is running, Reanimated should clean up useSharedValue automatically, but verify.	🟡
6.3	Are images caching properly?	Ensure expo-image is used with cachePolicy="memory-disk". Without caching, scrolling through videos/moods reloads images constantly.	🟢
7. BUILD & BUNDLE SIZE
#	Checkpoint	How to Verify	Status
7.1	What is the bundle size?	Run npx expo export:embed or check EAS build logs. Target < 50 MB.	🟡
7.2	Are you using react-native-svg correctly?	Large SVG files (e.g., custom icons, breathing circles) can increase bundle size. Use SVGR to convert to JSX components instead of bundling raw .svg files.	🟢
7.3	Are you tree-shaking unused modules?	Check imports. Are you importing entire lucide-react-native instead of specific icons? (e.g., import { Flame } from 'lucide-react-native' vs import * as Lucide).	🔴
📊 GENERATE YOUR REPORT
Copy this table into a doc. For each checkpoint, write your finding and the fix you applied.

Section	# Critical Issues	# Warnings	Status
JS Thread	0	0	✅/❌
UI & Lists	0	0	✅/❌
Luna (3D)	0	0	✅/❌
Startup	0	0	✅/❌
DB/Network	0	0	✅/❌
Memory	0	0	✅/❌
🚀 Immediate "Low Hanging Fruit" to Fix FIRST (The 80/20 Rule)
Wrap Heavy Lists in React.memo: If you have a renderItem in FlatList that renders complex cards, wrap that component in React.memo.

Add getItemLayout to Lists: If your list items have fixed heights, add getItemLayout. This skips the native layout calculation for scroll events.

Check the 3D Cat: Ensure react-native-filament is not rendering when the user scrolls or switches tabs. Pause the render loop.

Kill Stale Effects: Search for useEffect with heavy await functions. Move those fetches to React Query (useQuery), which caches the result, eliminating the need to refetch on mount.

 SHE CARE — DEAD CODE & ORPHANED EXPORTS AUDIT PROMPT
Goal: Identify and remove all files, components, and hooks that are no longer referenced anywhere in your mobile/src directory, reducing bundle size and build time.

Step 1: Run ts-prune (The Automated Scanner)
First, let's use an automated tool to find unused exports (which often point to dead files).

bash
cd mobile
npx ts-prune --project tsconfig.json | grep -v "used in module" | sort
Action: This will list all exported functions/hooks that are never imported.
If this is too noisy, run npx ts-prune and look for large chunks of exports from files you know are feature-complete.

Step 2: The "Screens & Navigation" Graveyard (Critical)
We removed tabs and stacks, but sometimes forgot the files.

#	File Path	Check this file	Why it's likely dead	Status
1	src/navigation/AIChatStack.tsx	DELETE	We removed the AI Chat tab. MainTabs.tsx doesn't import this.	⬜
2	src/screens/chat/AIChatScreen.tsx	DELETE	Fake/Luna-chat replaced by Luna Overlay + RaaS reports.	⬜
3	src/screens/admin/ (Entire folder)	DELETE	Admin moved to web-admin (via the cleanup plan).	⬜
4	src/services/api/admin.ts	DELETE	Admin API calls are unused.	⬜
5	src/services/queries/admin.ts	DELETE	Admin React Query hooks are unused.	⬜
6	src/hooks/useHomeAlwaysListening.ts	DELETE	Replaced by the Tap-to-Speak session (useLunaMicSession).	⬜
7	src/hooks/useShouldListen.ts	DELETE	Gating hook for always-on listening (scrapped).	⬜
Step 3: The "Never Imported" UI Components
Components we built for specific screens but then decided to inline or abandon.

#	File Path	Check this file	Why it's likely dead	Status
8	src/components/ui/MetricStepper.tsx	DELETE	Mentioned in the Lucide icon migration plan as "Unused".	⬜
9	src/components/ui/dayDetail/ (old stale components)	CHECK	Double-check that PhaseDetailSheet was successfully extracted.	⬜
Step 4: The "Old Data" / Test / Plan Files
You have plans/ and UI_UX/ folders at the root, but are they accidentally imported?

#	File Path	Check this file	Status
10	src/__tests__/test_system_test*.test.ts (System tests)	KEEP (unless migrated). Usually not bundled.	⬜
11	/plans/*.md and /UI_UX/*.md	CHECK	Ensure the Metro bundler is not watching these. If they are inside src/, move them to the root ../ (outside src/). Markdown files in src/ will be parsed by Metro if imported accidentally.	⬜
Step 5: Dependency Check (Bundle Bloat)
Some libraries are only used for dead code or are overkill.

#	Library	Check this	Status
12	react-native-voice or expo-speech-recognition	CHECK	If you haven't landed STT yet, is the dependency still lingering in package.json? If it's installed but unused, it adds ~2-4 MB to the native binary.	⬜
13	expo-av	CHECK	We applied a patch for it, but if you fully moved to expo-audio for the new Luna sounds, you can uninstall expo-av.	⬜
🛠️ The "Nuclear" Cleanup Command (Find + Delete in Bulk)
If you want to aggressively delete everything we know is dead, run this (confirm the paths first):

bash
# Delete Admin (already moved to web)
rm -rf mobile/src/screens/admin
rm mobile/src/services/api/admin.ts
rm mobile/src/services/queries/admin.ts

# Delete Old AI Chat (replaced by Luna Overlay)
rm mobile/src/navigation/AIChatStack.tsx
rm mobile/src/screens/chat/AIChatScreen.tsx

# Delete Old Listening Hooks (replaced by Tap-to-Speak)
rm mobile/src/hooks/useHomeAlwaysListening.ts
rm mobile/src/hooks/useShouldListen.ts
✅ Why This Matters for Performance
Bundle Size: Every dead screen (like AdminDashboard) and unused icon (MetricStepper) is code that Metro has to parse and bundle. Removing 10 dead files saves ~50-200KB per file in the JavaScript bundle.

Native Build Time: Dead libraries (like expo-av or admin dependencies) cause CMake/NDK to compile unnecessary native code, increasing build time by 5-10 minutes.

Runtime Memory: Dead hooks (like useHomeAlwaysListening) often have lingering event listeners or timers that consume CPU cycles if not properly unmounted. Deleting them ensures a cleaner memory profile.

Action: Run the ts-prune command, identify which of the above are still hanging around, and we'll write the exact rm -rf commands to nuke them. 🚀