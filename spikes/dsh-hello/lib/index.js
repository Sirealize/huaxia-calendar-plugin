// src/index.ts
/**
* Host half of the Phase 0 spike bundle.
*
* The calendar is a browser-only UI plugin for the spike, so the host half is a
* deliberately empty Cordis plugin: it exists so `dsh.bundle.patch` has a row to
* insert, which is what makes the bundle installable through a profile.
*/
const name = "dsh-hello-huaxia";
function apply() {}
export { apply, name };
