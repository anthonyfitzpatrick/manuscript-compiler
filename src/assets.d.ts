/**
 * Manuscript Compiler — compile-time declarations for bundled visual assets.
 *
 * SVG imports are converted to raw text by the production bundler so settings
 * artwork remains offline, mobile-safe, and contained in main.js. This file
 * describes that build boundary only; it does not load files at runtime or add
 * release-package assets. Keep the declaration aligned with esbuild.config.mjs.
 */
declare module "*.svg" {
  const rawSvg: string;
  export default rawSvg;
}
