# MedCore Pro

## Project Overview

MedCore Pro is a React + Vite clinical management web app. It includes patient, appointment, doctor, medication, reporting, export/import, consultation, Supabase sync, and Gemini-assisted clinical helper features.

## Tech Stack

- React 19 with TypeScript
- Vite 6
- Tailwind CSS 4 via `@tailwindcss/vite`
- Supabase client for cloud sync
- Google GenAI SDK for optional AI helpers

## Replit Setup

- Development server: `npm run dev`
- Preview port: `5000`
- Vite is configured with `host: "0.0.0.0"` and `allowedHosts: true` so the Replit preview proxy can load the app.
- Deployment target: static site built with `npm run build`, served from `dist`.

## Notes

- `GEMINI_API_KEY` is read by Vite and exposed to the client build for the existing Gemini service.
- Supabase URL and publishable anon key are currently defined in `services/supabase.ts`.
- Consultation print mode uses body classes to show only the prescription or exam portal content during print; the main app root is hidden with visibility rather than display to avoid blank pages.
- New runtime records use `crypto.randomUUID()` for patients, files, doctors, users, appointments, and medications.
- Sensitive consultation specialties such as Psicologia and Psiquiatria require an access password before finalization; the stored value is SHA-256 hashed.
- Backup export receives the current in-memory database state so recent unsynced edits are included.