// Build-only placeholder to keep TypeScript build fast and narrow for production CI.
// This file intentionally contains no imports to avoid pulling in the entire source graph.
// Real runtime transpilation is handled by tsx during dev and Dockerized runtime.

// Ambient declarations that may be referenced by lightweight entrypoints/tests
declare const __UNIT_TALK_BUILD__: true;
export {};
