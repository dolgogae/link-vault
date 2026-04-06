# Repository Guidelines

## Project Structure & Module Organization
`app/` contains Expo Router screens, with route groups such as `app/(tabs)/` for the main product flow and `app/(auth)/` for sign-in and onboarding. Reusable UI lives in `components/`, shared state in `stores/` (Zustand), business logic in `services/` and `hooks/`, and shared types/constants in `types/` and `constants/`. Tests live under `__tests__/`, matching the area under test (`__tests__/hooks`, `__tests__/stores`, `__tests__/utils`). Firebase Cloud Functions are isolated in `functions/src/`. Static assets belong in `assets/`.

## Build, Test, and Development Commands
Use the root package for app work:

- `npm install` installs app dependencies and applies `patch-package`.
- `npm run start` starts the Expo dev server.
- `npm run android` or `npm run ios` runs the native app locally.
- `npm run web` starts the web target for quick UI checks.
- `npm test` runs the Jest suite.

Use the `functions/` package for backend work:

- `cd functions && npm install` installs function dependencies.
- `cd functions && npm run build` compiles TypeScript to `functions/lib/`.
- `cd functions && npm run serve` builds and starts the Firebase Functions emulator.
- `cd functions && npm run deploy` deploys functions.

## Coding Style & Naming Conventions
TypeScript is strict; prefer explicit, typed interfaces over loose objects. Prettier rules are enforced through ESLint: 2-space indentation, semicolons, single quotes, trailing commas, and `printWidth` 100. Follow existing naming patterns: PascalCase for components (`LinkCard.tsx`), camelCase for hooks/services/utilities (`useShareIntent.ts`, `links.ts`), and colocated route files under `app/`. Use the `@/` path alias instead of long relative imports.

## Testing Guidelines
Jest uses `jest-expo`. Add tests beside the existing suites under `__tests__/` and name them `*.test.ts`. Focus coverage on pure utilities, hooks, and store behavior; mock Firebase and native integrations through `__mocks__/` when needed. Run `npm test` before opening a PR.

## Commit & Pull Request Guidelines
Recent history follows Conventional Commits (`feat:`, `fix:`, `refactor:`, `docs:`). Keep subjects short and imperative, for example `fix: handle empty category path`. PRs should include a concise description, linked issue or task, notes about Firebase or env changes, and screenshots for UI changes. Call out any manual verification steps, especially for auth, subscriptions, sharing, or native builds.

## Security & Configuration Tips
Do not commit secrets from `.env`, Firebase config, or signing keys. Treat files such as `GoogleService-Info.plist`, `google-services.json`, and keystores as deployment-sensitive; update them only when required and mention it clearly in the PR.
