/* Ambient globals for Browserify-bundled TypeScript modules in src/ts/. */

interface BrowserifyRequire {
  (id: string): any;
}

declare var require: BrowserifyRequire;
declare var module: { exports: any };
declare var exports: Record<string, unknown>;
declare var dataLayer: Array<Record<string, unknown>>;

interface Window {
  webkitAudioContext?: typeof AudioContext;
  dataLayer?: Array<Record<string, unknown>>;
}
