/**
 * Manuscript Compiler — documented host-version compatibility access.
 *
 * Provides diagnostics with Obsidian's public API version and deliberately owns
 * no Electron/platform detection. Called by plugin composition/support paths;
 * calls only the Obsidian API constant. Pure, non-throwing, non-cancellable, and
 * identical on desktop/mobile. Do not reintroduce desktop-only probes here.
 */
import { apiVersion } from "obsidian";
/** Returns the host API version without inspecting environment or filesystem data. */
export function getObsidianVersion(): string { return apiVersion; }
