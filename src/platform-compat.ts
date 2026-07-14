/** Documented host-version access; export delivery is platform-neutral. */
import { apiVersion } from "obsidian";
export function getObsidianVersion(): string { return apiVersion; }
