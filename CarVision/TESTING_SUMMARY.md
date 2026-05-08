# Testing Summary

## How to run

Run:

`npm test`

## Test size

- Test suites: 5
- Expected total tests: 46

## Coverage mapping for the slide

- Functional Testing:
  - `apps/server/__tests__/functional.test.js`
  - `apps/mobile/__tests__/dtc.test.js`
  - Ping API checks, auth validation, unauthorized access handling, diagnostics fallback, and safe error handling

- Integration Testing:
  - `apps/server/__tests__/integration.test.js`
  - Supertest verifies Express routes + auth middleware behavior without starting the real server

- Real-Time Testing:
  - `apps/server/__tests__/realtime.test.js`
  - Telemetry validation for RPM, speed, coolant, and invalid frame handling

- UI/UX Testing:
  - `apps/mobile/__tests__/ui-helpers.test.js`
  - Safe display text, vehicle metrics, status badges, diagnostic severity, navigation target validation, and image fallback

## Current result

Run `npm test` to verify all tests PASS.
