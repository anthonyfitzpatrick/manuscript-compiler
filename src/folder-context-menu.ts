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
