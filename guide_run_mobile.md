# Running the Mobile App (Expo)

The project uses **Expo SDK 56** (bare workflow). You can test with **Expo Go** for basic screens, but some native modules (`react-native-encrypted-storage`, `react-native-push-notification`, `react-native-fast-image`) are not Expo Go compatible — those screens need a **dev client** build.

---

## Quick start

```bash
cd mobile
npm run start
```

This starts the Expo dev server. You'll see a QR code — scan it with **Expo Go** (Android) or the **Camera** app (iOS).

Press `a` to open Android emulator, `i` for iOS simulator.

> **Windows users:** Only Android testing is available (iOS requires macOS).

---

## What's set up

| File | What it does |
|------|-------------|
| `app.json` | Expo config (name, slug, scheme, plugins) |
| `babel.config.js` | Uses `babel-preset-expo` |
| `index.js` | Uses `registerRootComponent` from Expo |
| `tsconfig.json` | Extends `expo/tsconfig.base` |
| `package.json` | Scripts updated to `npx expo start` / `npx expo run:*` |

Expo packages installed: `expo`, `expo-dev-client`, `expo-status-bar`, `expo-notifications`, `expo-image`, `expo-network`.

---

## First Android build (dev client)

For full native module support (encrypted storage, push notifications, fast image):

1. Connect an Android device via USB (or start an emulator)
2. Run:

```bash
npm run android
```

This builds a custom dev binary with all native modules. Subsequent runs use hot reload — no rebuild needed.

---

## Troubleshooting

### Metro port conflict

```bash
npx expo start --port 8082
```

### Expo Go shows "Cannot find expo module" or blank screen

Some native modules aren't supported by Expo Go. Build a dev client instead:

```bash
npm run android
```

### Bundle fails to compile

Check for TypeScript errors first:

```bash
npm run typecheck
```

### Clean node_modules

```bash
rm -rf node_modules
npm install --legacy-peer-deps
```

---

## Useful commands

| Command | What it does |
|---------|-------------|
| `npm run start` | Start Expo dev server |
| `npm run android` | Build + run on Android |
| `npm run ios` | Build + run on iOS (macOS only) |
| `npm run typecheck` | TypeScript type check |
| `npm run lint` | ESLint |
| `npm run format` | Prettier format |
