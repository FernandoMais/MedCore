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