# Time-based theme policy

The authenticated space defaults to automatic themes in the device's local time:

| Local time | Stable theme ID |
| --- | --- |
| 05:00–09:59 | light |
| 10:00–15:59 | forest |
| 16:00–18:59 | dawn |
| 19:00–04:59 | dark |

A manual pick overrides only the current slot. The next boundary T1 restores the time theme. The night slot starts at 19:00 on the previous date and survives midnight until 05:00. All six theme IDs and frozen reference images remain unchanged.

Settings exposes “随时间自动切换”, on by default. Turning it off saves the visible palette as the account's long-term theme; subsequent manual picks remain effective across slots and restarts. Turning it on clears the temporary override and resumes the time theme. Preferences are local to the device and keyed by account ID. Existing legacy permanent-manual flags migrate to auto-off to preserve those explicit choices.

A reactive clock schedules the next local boundary, with a 250 ms timer grace period. onShow re-reads wall time and schedules again after background suspension. onHide stops the timer and clears stale keyboard height. Automatic repainting waits while the keyboard is open, then applies the latest policy. Explicit appearance choices apply immediately. Main and journey pages share the same policy.

Manual selections refresh wall time before capturing their slot, including taps just after a boundary but before its timer callback. Failed profile saves roll back the choice; late failures and notifications cannot affect a different signed-in account. No AI calls or privacy-setting changes are involved.

## Acceptance — 2026-10-24

Tests cover four boundaries, overnight slot identity, restart persistence, account isolation, timer disposal, background catch-up, typing deferral, the boundary-tap race, auto on/off, and save rollback. Native compiler and final test results are recorded at completion below.

An isolated tourist Mini Program copy was prepared under output/theme-slot-qa. CLI auto reported success, but SDK connections failed; a bounded SDK launch retry also failed. Simulator interaction and physical-device acceptance therefore remain unverified. Compiler success is reported separately and is not treated as UI acceptance.

Final checks: TypeScript passed; frontend 205/205 passed (36 files); build and native WXML/WXSS compilation passed. A busy-machine run exceeded the existing 5-second original-image hash-test deadline; the complete rerun with a command-line 20-second test timeout passed. No test timeout configuration was changed. All six frozen reference hashes passed. The isolated native attempts failed to connect/launch the automation runtime; no simulator or physical-device interaction pass is claimed. No model calls were made.
