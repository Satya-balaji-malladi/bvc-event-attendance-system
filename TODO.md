# TODO - SessionService.js refactor

- [x] Gather repo context (Config.js, DatabaseService.js, Utils.js, SessionService.js).
- [x] Identify remaining violations (SpreadsheetApp usage, DatabaseService.findAll usage).
- [ ] Refactor SessionService.js to:
  - [ ] Remove every SpreadsheetApp usage.
  - [ ] Remove every DatabaseService.findAll() usage.
  - [ ] Prefer CONFIG.COLUMNS constants; if missing, fallback to existing header name used by this project and add TODO comments.
  - [ ] Ensure every public method uses try/catch, logs with Logger.log(), and preserves return format.
  - [ ] Ensure no undefined CONFIG references and no undefined DatabaseService methods.
  - [ ] Self-review for GAS compatibility and production readiness.
- [ ] Mark completion.

