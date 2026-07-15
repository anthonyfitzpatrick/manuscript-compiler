/**
 * Manuscript Compiler — File Explorer folder action.
 *
 * Adds one documented menu item only for TFolder and delegates the exact clicked
 * object to main.ts. It contains no inference, preparation, or legacy compile path.
 * main.ts registers and disposes the workspace event through plugin lifecycle.
 * The callback has only transient menu side effects, performs no vault mutation,
 * and has no cancellation phase. Preserve keyboard/menu accessibility and the
 * same folder-only behavior on desktop and mobile hosts.
 */
import { TFolder, type Menu, type TAbstractFile } from "obsidian";

export const COMPILE_FOLDER_MENU_TITLE = "Compile manuscript from this folder";

/** Adds the documented File Explorer action without doing any preparation in the menu callback. */
export function addCompileFolderMenuItem(menu: Menu, file: TAbstractFile, openCompiler: (folder: TFolder) => void): boolean {
  if (!(file instanceof TFolder)) return false;
  menu.addItem((item) => {
    item
      .setTitle(COMPILE_FOLDER_MENU_TITLE)
      .setIcon("book-open")
      .onClick(() => openCompiler(file));
  });
  return true;
}
