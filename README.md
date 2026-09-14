# Tudso

<div align="center">
  <img src="public/icon.png" alt="Tudso app logo" width="120" height="120" />
</div>

<div align="center">
  <img src="https://img.shields.io/badge/License-AGPL%20v3-purple.svg" alt="AGPL 3.0" />
  <img src="https://img.shields.io/badge/Electron-43-4A9DFF?logo=electron&logoColor=white" alt="Electron" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white" alt="React 19" />
  <img src="https://img.shields.io/badge/TypeScript-6.x-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Node.js-20%2B-47A248?logo=node.js&logoColor=white" alt="Node 20+" />
</div>

<div align="center">
  <h3>AI Interview Copilot for fast, smarter, more confident practice.</h3>
</div>

<p align="center">
  <strong>Built by <a href="https://github.com/Sysfora">Sysfora</a></strong>
</p>

Tudso is a floating desktop AI assistant made by Sysfora to help users prepare for interviews, improve communication, and answer with greater clarity and speed. It blends a polished local desktop experience with a secure backend for AI orchestration, resume parsing, account management, and subscription enforcement.

## About Sysfora

Sysfora creates focused, practical software tools that reduce friction and improve real-world outcomes. Tudso is one of the company’s desktop-first AI products designed to make interview preparation feel fast, personal, and useful at the moment of need.

## Why this project exists

Many interview prep tools are either too generic, too noisy, or too disconnected from the user’s real context. Tudso focuses on the practical path:

- use the user’s resume and profile as context
- answer in the user’s preferred language
- keep answers concise and immediately usable
- adapt to the company, role, and situation
- support live screen and audio-aware assistance in a desktop workflow

The result is a focused desktop experience for rapid, real-time answer generation without forcing the user into a heavy browser flow.

## Core features

- Resume onboarding and extraction
- Profile-aware AI answers
- Company and role context support
- Preferred answer language support
- Session setup with plan and usage metadata
- Live copilot and screen-based answer workflows
- Conversation memory and context persistence
- Secure backend-only secret handling
- Stripe billing and entitlement checks
- Desktop app packaging for Linux, macOS, and Windows

## Product experience

Tudso is designed to feel like a lightweight companion:

- a floating, non-intrusive desktop surface
- concise answers instead of long-winded explanations
- AI context informed by user experience, resume, and goals
- minimal friction during session setup and answer generation
- quick actions like answer-from-screen and live copilot without cluttering the UI

## Architecture

```text
┌──────────────────────────────────────────────┐
│          Electron Desktop App               │
│  Renderer UI • Window controls • Capture     │
│  Secure preload • Local app state            │
└──────────────────────┬───────────────────────┘
                       │
                       │ IPC / authenticated API calls
                       ▼
┌──────────────────────────────────────────────┐
│               Backend Service                 │
│  Auth • AI orchestration • Sessions           │
│  Resume parsing • Memory • Profile logic      │
│  Entitlements • Stripe integrations          │
└──────────────────────┬───────────────────────┘
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
   PocketBase                 Stripe
```

This separation keeps provider keys, billing secrets, and admin-level access in the backend instead of exposing them to the renderer.

## Tech stack

- Electron
- React 19
- Vite
- TypeScript
- Tailwind CSS
- Zustand
- PocketBase
- OpenAI-compatible AI backend
- Stripe

## Development workflow

```bash
# install root deps
npm install

# install server deps
cd server && npm install
```

Then configure the app and backend environment, then run:

```bash
npm run dev
```

This starts the application in development mode with the backend and UI connected together.

## Build, test, and package

### Build

```bash
npm run build
```

### Type checking

```bash
npm run typecheck
```

### Linting

```bash
npm run lint
```

### Running tests

```bash
npm test
```

### Desktop packaging

```bash
npm run package
```

Platform-specific packaging is also supported:

```bash
npm run package:linux
npm run package:mac
npm run package:win
```

## Scripts overview

```bash
npm run dev            # start app in dev mode
npm run build          # build the server side
npm run typecheck      # TypeScript verification
npm run lint           # project linting
npm run test           # backend tests
npm run package        # package the desktop app
```

## Project structure

```text
.
├── src/
│   ├── main/
│   ├── preload/
│   ├── renderer/
│   └── shared/
├── server/
│   ├── src/
│   ├── public/
│   ├── data/
│   └── scripts/
├── scripts/
├── public/
├── EmailStructures/
├── build/
├── resources/
├── LICENSE
├── README.md
├── POCKETBASE_SETUP.md
├── STRIPE_SETUP.md
├── pb_schema.json
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts
└── eslint.config.js
```

## Setup notes

Before running the app, make sure the required environment is configured:

- PocketBase is running and the schema is imported
- Stripe plan setup is configured for subscriptions
- AI provider credentials are available to the backend only
- local desktop permissions are enabled where applicable

See:

- `POCKETBASE_SETUP.md`
- `STRIPE_SETUP.md`

## Security and privacy

Tudso is designed with a few strong safety principles:

- renderer code stays separate from secrets and billing logic
- AI provider access is backend-only
- subscription enforcement is server-side
- permission requests are limited to actual desktop features
- context, profile, and session data stay scoped to the user and device profile

## Data and AI behavior

The backend builds personalized prompts from:

- user profile data
- resume content
- goals and skill information
- remembered facts
- plan and session metadata
- answer preference settings such as language and tone

This makes the assistant more useful without requiring the user to manually repeat the same details every time.

## Roadmap highlights

Planned product evolution includes:

- richer multi-step interview flows
- stronger resume intelligence and better extracted context
- tighter live-copilot orchestration
- more session analytics and improvement metrics
- additional language and localization support
- more polished desktop interactions across Linux, macOS, and Windows

## License

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0).

The full license text is in the [LICENSE](LICENSE) file.

> AGPL 3.0 is a copyleft license intended to preserve open-source freedoms for users of networked software. If you modify and run this service in a way that users interact with over a network, the corresponding source must remain available under the same terms.

## Contributing

Contributions are welcome. If you are improving user experience, fixing bugs, enhancing interview prompts, or strengthening the desktop experience, feel free to open a pull request.

## Project status

Tudso is an active desktop AI product under active iteration, with ongoing work focused on onboarding flow improvements, session setup, permissions, AI prompt quality, and desktop polish.

## Contact

- Project: Sysfora
- Repository: https://github.com/Sysfora/Tudso

---

<div align="center">
  <sub>Built with ❤️ for faster, clearer, more confident interview preparation.</sub>
</div>
