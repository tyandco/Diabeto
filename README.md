# Diabeto

Diabeto is a diabetes prevention and habit-tracking app built with Expo. It includes a local risk predictor, daily health logs, food and lifestyle guidance, and Ribbon, an AI health companion powered by the user's own Gemini API key.

This project was built for a school graduation project.

## Features

- Diabetes risk prediction from age, height, weight, glucose, family history, activity level, and sugary drink habits.
- Daily Log history for glucose, activity, sleep, water, balanced meals, mood, and notes.
- Ribbon chat assistant with text and food image support.
- Recent Daily Log and Predict data are compacted and sent to Ribbon for context.
- User-owned Gemini API key flow through Settings.
- Settings for light/dark/system appearance, color theme, in-app icon choice, and Ribbon tone.
- Web image attachment support.

## Tech Stack

- Expo SDK 54
- Expo Router
- React Native
- TypeScript
- AsyncStorage for local app data
- Gemini API for Ribbon

## Setup

Install dependencies:

```bash
npm install
```

Start the app:

```bash
npx expo start
```

For web:

```bash
npx expo start --web
```

## Gemini API Key

Ribbon does not use a shared API key from `.env`. Each user must add their own Gemini API key in the app:

1. Open Settings.
2. Tap `Get an API key` to open Google AI Studio.
3. Create/copy a Gemini API key.
4. Return to Diabeto.
5. Paste the key into Settings.

The key is stored locally in app storage. It is not committed to the repository.

The `.env` file may keep non-secret model settings:

```env
GEMINI_MODEL=gemini-2.5-flash-lite
EXPO_PUBLIC_GEMINI_MODEL=gemini-2.5-flash-lite
```

## Local Data

Diabeto stores app data locally with AsyncStorage:

- Health prediction context: `diabeto.health-context.v1`
- Chat messages: `diabeto.chat.messages.v1`
- Daily logs: `diabeto.daily-log.YYYY-MM-DD`
- App preferences: `diabeto.app-preferences.v1`

Daily logs are one entry per day. Saving again on the same day overwrites that day's log.

## Development Notes

Run TypeScript checks:

```bash
npx tsc --noEmit
```

Run lint:

```bash
npm run lint
```

Expo has changed across SDK versions. Before changing Expo-specific APIs or config, check the exact SDK 54 docs:

https://docs.expo.dev/versions/v54.0.0/

## Building for Android and iOS

Diabeto can be tested locally with Expo run commands or built with EAS Build.

### Local Android Run

Requirements:

- Android Studio
- Android SDK installed
- Android emulator or physical Android device

Run:

```bash
npm run android
```

This uses:

```bash
expo run:android
```

### Local iOS Run

Requirements:

- macOS
- Xcode
- iOS Simulator or physical iPhone

Run:

```bash
npm run ios
```

This uses:

```bash
expo run:ios
```

You cannot build or run iOS locally from Windows. Use EAS Build for iOS if you are not on macOS.

### CocoaPods for iOS

CocoaPods is only needed when working with the native iOS project on macOS. You do not run CocoaPods on Windows.

Install CocoaPods on macOS:

```bash
sudo gem install cocoapods
```

If the `ios` folder does not exist yet, generate the native iOS project:

```bash
npx expo prebuild --platform ios
```

Install iOS pods:

```bash
cd ios
pod install
cd ..
```

You can also use Expo's helper from the project root:

```bash
npx pod-install
```

Run CocoaPods again after adding or updating native dependencies, after changing iOS native config, or if Xcode complains about missing pods. Then rebuild the iOS app:

```bash
npm run ios
```

### EAS Build Setup

Install the EAS CLI:

```bash
npm install -g eas-cli
```

Log in:

```bash
eas login
```

Check or configure the project:

```bash
eas build:configure
```

### Android Builds

Build an Android APK for testing:

```bash
eas build --platform android --profile preview
```

Build an Android app bundle for Google Play:

```bash
eas build --platform android --profile production
```

The Android package is configured in `app.json`:

```json
"package": "com.tyandco.Diabeto"
```

### iOS Builds

Build iOS with EAS:

```bash
eas build --platform ios --profile production
```

Requirements:

- Apple Developer account
- iOS bundle identifier configured
- App signing handled by EAS or manually through Apple credentials

The iOS bundle identifier is configured in `app.json`:

```json
"bundleIdentifier": "com.anonymous.Diabeto"
```

Update the bundle identifier before release if needed.

### Build Notes

- User Gemini API keys are entered inside the app Settings screen, not bundled into the app.
- `.env` should only keep non-secret model settings unless you intentionally add development-only secrets.
- After changing native config in `app.json`, rebuild the native app.
- For app store release builds, use the `production` EAS profile.

## Important Limits

- Gemini free-tier keys can hit short rate limits or daily quota limits.
- Image messages cost more than text-only messages.
- The app compresses attached images before sending them to Gemini to reduce token usage.
- If Gemini appears to cut off a reply, the app shows a note instead of making automatic continuation requests, to avoid doubling rate-limit pressure.
