# Changelog

## Unreleased

- Added a Playwright-based e2e polish harness with deterministic mock auth/data for local browser verification.
- Moved global font loading into `next/font` to reduce external requests and improve performance stability.
- Added responsive, focus-visible, and reduced-motion UI polish to support cleaner accessibility and mobile behavior.
- Added stable visual regression coverage for home, chat, and cleared OBS overlay states.
- Hardened mock admin auth so login/session checks stay console-clean during e2e runs.
- Improved admin accessibility with explicit labels and accessible names for selectors, sliders, and color inputs.
- Serialized Playwright workers and stabilized security/admin flows to prevent shared mock-state race conditions.
- Verified five consecutive clean validation cycles across lint, build, type-check, and Playwright browser tests.
- Restored compatibility with older Supabase installs by allowing public event routes to work even when `events.overlay_cleared_at` is not present yet.
- Added a schema compatibility checker, `.env.example`, and a Supabase repair SQL script for existing deployments.
- Added full setup, troubleshooting, and operations documentation for live event admins.
