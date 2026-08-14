# Saved Compilations — Obsidian API Reference

## Purpose

This is an API feasibility reference for a future Saved Compilations feature. It records the current official Obsidian contracts relevant to persisting and restoring a compilation recipe. It is not a feature design: it does not define a saved-compilation schema, migration version, reconciliation algorithm, UI layout, service, command, or storage limit.

The feature must persist a recipe, not manuscript prose or a serialized prepared `Book`. It must reconcile that recipe with the current vault before preparation/export.

### Source labels

- **OFFICIAL OBSIDIAN CONTRACT** — documented by Obsidian or declared in the official `obsidian` API typings.
- **MANUSCRIPT COMPILER PROJECT CONVENTION** — an existing repository rule, not an Obsidian guarantee.
- **IMPLEMENTATION NOTE / INFERENCE** — a conservative conclusion drawn from those contracts; validate it during the architecture stage.

## Official APIs Relevant to Persistence

### Plugin Data Storage

**OFFICIAL OBSIDIAN CONTRACT**

`Plugin.loadData(): Promise<any>` and `Plugin.saveData(data: any): Promise<void>` load and write plugin data. Official typings document the storage location as `data.json` in the plugin folder. The official plugin guidance says to use these methods rather than managing plugin data files directly. The `Plugin` lifecycle also exposes optional `onExternalSettingsChange()`, called when `data.json` is modified externally (for example by Sync or another program), so a plugin can reload settings. [Plugin API](https://docs.obsidian.md/Reference/TypeScript%20API/Plugin) · [Plugin guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin%20guidelines) · [Manifest](https://docs.obsidian.md/Reference/Manifest)

`loadData` is typed as `any`, and `saveData` accepts `any`; the official contract does not supply a schema, validation, maximum size, transactional/atomic-save guarantee, cross-device conflict policy, or automatic migration. Treat the returned value and nested values as untrusted JSON-compatible data. Do not infer stronger persistence or synchronization guarantees.

Plugin data is per plugin installation inside a vault's configuration area, rather than manuscript content in the vault. It is therefore not a portable vault-independent identity store and must not be treated as a durable global identity across copied/renamed vaults.

**MANUSCRIPT COMPILER PROJECT CONVENTION**

Load once during `onload`, apply idempotent migration/repair before consumers see state, and save only through an owned persistence boundary. Current settings and history already follow this pattern in `src/settings.ts`, `src/profiles.ts`, `src/history-storage.ts`, and `src/main.ts`.

**IMPLEMENTATION NOTE / INFERENCE**

Use only ordinary JSON values (objects, arrays, strings, finite numbers, booleans, and null). Dates, `Map`, `Set`, class instances, `TFile`/`TFolder`, functions, `undefined`, and `BigInt` do not make a stable persisted recipe. Make all load and save failures visible to the owning UI/operation boundary rather than assuming success. The future design must decide bounded collection/history limits explicitly; Obsidian publishes no suitable size limit.

## File and Folder Identity

### Vault, files, and paths

**OFFICIAL OBSIDIAN CONTRACT**

`Vault` is the public abstraction for files and folders visible in the app. `TAbstractFile` has `vault`, `path`, `name`, and `parent`; it is either `TFile` or `TFolder`, so code must narrow with `instanceof TFile` / `instanceof TFolder`. `TFile` adds `basename`, `extension`, and `stat`; `TFolder` adds `children` and `isRoot()`. [Vault guide](https://docs.obsidian.md/Plugins/Vault) · [Vault API](https://docs.obsidian.md/Reference/TypeScript%20API/Vault) · [TAbstractFile API](https://docs.obsidian.md/Reference/TypeScript%20API/TAbstractFile)

`Vault.getAbstractFileByPath(path)` returns a `TAbstractFile | null`; its official typing describes the path as vault-absolute, extension-bearing, and case-sensitive. `getFileByPath` and `getFolderByPath` are typed convenience methods since 1.5.7. `getMarkdownFiles()` returns Markdown `TFile`s; `getFiles()` returns all files, not folders. `getAllLoadedFiles()` includes files and folders. Use `Vault.recurseChildren(root, callback)` only when the caller already has a current `TFolder` root.

`TFile.stat` is `FileStats` with `ctime`, `mtime`, and `size` (timestamps are Unix milliseconds; size is bytes). These are observable attributes, not a documented immutable file identifier or content hash. `Vault.rename(file, newPath)` can rename or move an item; the documentation advises using `FileManager.renameFile` when writing an operation that should update links automatically. A delete makes path lookup return `null` after the vault state changes. [Vault guide](https://docs.obsidian.md/Plugins/Vault)

For reads, `cachedRead(file)` is for display-only reads; `read(file)` is for a read-then-write flow. The official guide states their difference concerns a file modified outside Obsidian immediately before the read; after the filesystem notification or an Obsidian save, the cache is flushed and `cachedRead()` behaves like `read()`. This plugin's preparation use must continue to choose the documented read appropriate to its purpose.

`vault.adapter` is public, but the official plugin guidance says to prefer the Vault API and avoid the Adapter API whenever possible. The Vault API sees only files visible inside the app; the official Vault guide says hidden-folder files require Adapter access. That limitation is not relevant to normal manuscript selection and does not justify an adapter dependency.

**MANUSCRIPT COMPILER PROJECT CONVENTION**

The author-selected `TFolder` is the exact manuscript root. The root is never a structural heading. Exports must not write into the vault; browser download remains the only export delivery route.

**IMPLEMENTATION NOTE / INFERENCE**

Persisting a normalized vault-relative path can locate a current candidate through `getAbstractFileByPath`, but a path alone does not survive rename/move/delete. `ctime`, `mtime`, and `size` can support staleness/reconciliation evidence but cannot prove identity or unchanged prose. Retain only the minimum path/structural evidence required by the later design, and rebuild current `TFile`/`TFolder` objects from the live vault after loading.

## File Change Detection

**OFFICIAL OBSIDIAN CONTRACT**

`Vault` emits `create(file)`, `modify(file)`, `delete(file)`, and `rename(file, oldPath)` events, each returning an `EventRef` from `on`. The official typings define all four events; `rename` supplies the old path. The official load-time guide warns that `create` is emitted for every existing file during vault initialization. Register that handling in `Workspace.onLayoutReady`, or ignore events until `workspace.layoutReady`, when startup events must not be treated as user changes. [Events](https://docs.obsidian.md/Plugins/Events) · [Optimize plugin load time](https://docs.obsidian.md/plugins/guides/load-time) · [Vault API](https://docs.obsidian.md/Reference/TypeScript%20API/Vault)

`Plugin.registerEvent(eventRef)` detaches the handler when the plugin unloads. This is the documented lifecycle-safe registration mechanism. `Plugin.registerInterval` and `Plugin.registerDomEvent` similarly own timers and persistent DOM event listeners.

**IMPLEMENTATION NOTE / INFERENCE**

Later architecture should use these events only to mark relevant saved recipes potentially stale or to refresh a live review, not to eagerly reparse every manuscript or to claim an event sequence is a complete audit log. Rename events are required to update/reconcile path evidence. Deletion must tolerate the object no longer being resolvable. The architecture stage must decide relevance filtering, batching/debouncing, and whether staleness is calculated lazily instead.

## Metadata Cache

**OFFICIAL OBSIDIAN CONTRACT**

`app.metadataCache.getFileCache(file)` returns `CachedMetadata | null`. Its `frontmatter` is optional and typed as `FrontMatterCache`, which official typings define as `any | null | undefined`; cached metadata is therefore not a domain-typed source. `MetadataCache` emits `changed(file, data, cache)` after a file is indexed and its updated cache is available; it does not fire for a rename, for which the typings explicitly require the Vault rename event. It also emits `deleted(file, prevCache)`, `resolve(file)`, and `resolved()`. [MetadataCache API](https://docs.obsidian.md/Reference/TypeScript%20API/MetadataCache)

The cache is an indexed view, not a replacement for `Vault` operations or a documented persistence layer. `getFileCache` can return `null`, and cached content must be considered unavailable until indexed. `FileManager.processFrontMatter` is the official write API for frontmatter, but Saved Compilations has no reason to write author metadata.

**MANUSCRIPT COMPILER PROJECT CONVENTION**

External metadata enters typed code as `unknown` → validation → narrowing → domain type. Existing code already normalizes frontmatter through `recordValue` and filtering logic rather than trusting it as a project type.

**IMPLEMENTATION NOTE / INFERENCE**

Persisted saved-compilation data and cached frontmatter are separate untrusted inputs. Never persist arbitrary frontmatter values merely to restore a recipe, and do not use metadata cache events as proof that a physical file was renamed or that all vault changes have settled.

## Events and Lifecycle

**OFFICIAL OBSIDIAN CONTRACT**

`Plugin.onload()` is the plugin initialization entry point and `onunload()` is the teardown hook. `Workspace.onLayoutReady(callback)` invokes the callback immediately if the layout is already ready, otherwise after it is ready. `Workspace` emits `file-menu(menu, file, source, leaf?)`, `files-menu`, `editor-menu`, `file-open`, layout, resize, and popout-window events. [Events](https://docs.obsidian.md/Plugins/Events) · [Workspace API](https://docs.obsidian.md/Reference/TypeScript%20API/Workspace)

**IMPLEMENTATION NOTE / INFERENCE**

Keep `onload` lightweight: load/repair persisted data and register essential integrations, but defer optional collection refreshes until layout readiness. On unload, registration ownership must release listeners; active UI/controller work should still be cancelled/closed according to this project's existing operation rules. Do not rely on quit/unload as an opportunity for required persistence.

## Settings and Migration

**OFFICIAL OBSIDIAN CONTRACT**

Obsidian provides `PluginSettingTab`, `Setting`, and the standard components for imperative settings UI. Current official guidance also introduces declarative setting definitions in 1.13.0; it explicitly recommends retaining the existing `display()` path for compatibility below 1.13.0, or using declarative settings only after raising `minAppVersion` to 1.13.0. [Migrate to declarative settings](https://docs.obsidian.md/plugins/guides/migrate-declarative-settings)

The `manifest.json` `minAppVersion` controls the oldest compatible host. `versions.json` maps plugin versions to changed minimum host versions and only needs an entry when the minimum changes. [Manifest](https://docs.obsidian.md/Reference/Manifest) · [Versions](https://docs.obsidian.md/Reference/Versions)

**MANUSCRIPT COMPILER PROJECT CONVENTION**

Persisted settings/history are untrusted. `migrateSettings` translates known historical representations; `repairSettings` validates/bounds data and is idempotent. Explicit false/zero values and valid custom formatting must survive repair. Histories are bounded and omit prose, raw metadata, absolute paths, and external destinations.

**IMPLEMENTATION NOTE / INFERENCE**

Saved-compilation state should use the same one persistence boundary and separate known migration from defensive repair. No third-party settings framework is necessary. The architecture stage must decide whether saved recipes are part of the existing root data or another logical section; this reference deliberately does not decide it.

## UI APIs

**OFFICIAL OBSIDIAN CONTRACT**

`Modal` supplies `open()`, `close()`, `onOpen()`, `onClose()`, `contentEl`, and `setTitle()`. Official typings state that a modal opens on the active window and animates on phones. `Setting` composes standard controls including `ButtonComponent`, `DropdownComponent`, `ToggleComponent`, and `TextComponent`; their value/change/disabled APIs are public and broadly available well before 1.5.0. `Notice` is for timely, high-value notification. [Modal API](https://docs.obsidian.md/Reference/TypeScript%20API/Modal) · [Setting API](https://docs.obsidian.md/Reference/TypeScript%20API/Setting) · [Notice API](https://docs.obsidian.md/Reference/TypeScript%20API/Notice)

`WorkspaceLeaf` is a view container. Its parent can be `WorkspaceTabs` on desktop or `WorkspaceMobileDrawer` on mobile; code must not assume a desktop-only parent. `Workspace.activeLeaf` is deprecated; official typings recommend `getActiveViewOfType` for current-view information and `getLeaf` for opening/navigating. [WorkspaceLeaf API](https://docs.obsidian.md/Reference/TypeScript%20API/WorkspaceLeaf)

**MANUSCRIPT COMPILER PROJECT CONVENTION**

The guided compiler remains a three-stage workspace. Renderers do not own semantic or persistence state. UI must use scoped CSS, visible focus, sentence-case labels, keyboard-safe controls, narrow-pane reflow, and mobile-safe behavior.

**IMPLEMENTATION NOTE / INFERENCE**

Selection, save, save-as, rename, duplicate, delete, restore, and reconciliation review should be designed against these standard controls and the existing modal/controller ownership. A future dedicated workspace view is not justified merely because `WorkspaceLeaf` exists.

## Commands and Context Menus

**OFFICIAL OBSIDIAN CONTRACT**

`Plugin.addCommand(command)` registers a global command; the host prefixes the command ID/name with the plugin identity. The `Command` type supports callback and editor callback variants. `Workspace` emits `file-menu` with a `Menu`, `TAbstractFile`, source, and optional leaf. `Menu.addItem` receives a `MenuItem`; set title/icon/disabled state and attach its `onClick` before the menu is shown. [Plugin API](https://docs.obsidian.md/Reference/TypeScript%20API/Plugin) · [Workspace API](https://docs.obsidian.md/Reference/TypeScript%20API/Workspace) · [Menu API](https://docs.obsidian.md/Reference/TypeScript%20API/Menu)

Folder actions must narrow the menu's `TAbstractFile` with `instanceof TFolder`; the File Explorer event is not a guarantee that the target is a folder. Event registration belongs to `registerEvent` so it detaches at unload.

**MANUSCRIPT COMPILER PROJECT CONVENTION**

Existing stable command IDs and the exact-folder File Explorer route must remain stable. No Saved Compilations command or context menu is created by this research stage.

## Mobile Compatibility

**OFFICIAL OBSIDIAN CONTRACT**

The public `Vault`, `Plugin` data, metadata cache, events, commands, menus, standard settings components, `Modal`, and browser/DOM APIs above are platform-neutral Obsidian APIs. `Platform` exposes `isDesktop`, `isMobile`, `isDesktopApp`, `isMobileApp`, `isIosApp`, and `isAndroidApp` when a genuine platform distinction is needed. The manifest `isDesktopOnly` describes whether a plugin depends on NodeJS/Electron APIs. [Manifest](https://docs.obsidian.md/Reference/Manifest) · [Platform API](https://docs.obsidian.md/Reference/TypeScript%20API/Platform)

**MANUSCRIPT COMPILER PROJECT CONVENTION**

The plugin supports macOS, Windows, Linux, iOS, and Android (`isDesktopOnly: false`). It prohibits Electron and Node filesystem runtime dependencies, shells, external executables, Pandoc, and platform-specific filesystem assumptions.

**IMPLEMENTATION NOTE / INFERENCE**

Saved Compilations must continue using `Plugin.loadData`/`saveData` and public Vault APIs, not desktop adapter paths. Design review UI for constrained mobile dimensions and touch without a desktop-only alternative. Do not use `Menu.setUseNativeMenu`, which the API says works only on desktop.

## Optional Plugin Interoperability

**OFFICIAL OBSIDIAN CONTRACT**

The public API/docs consulted for this reference expose a plugin's own lifecycle, commands, views, data, vault, workspace, and metadata facilities. They do not document a stable public API for locating arbitrary loaded community-plugin instances, reading another plugin's private data, or receiving another plugin's enable/disable lifecycle.

**IMPLEMENTATION NOTE / INFERENCE**

Do not base Saved Compilations on undocumented internals such as `app.plugins`, casts to internal plugin-manager shapes, another plugin's private settings/data files, or assumed plugin IDs. If a future optional integration with Metadata Visuals or Publishing Manager is considered, it needs an explicitly documented, versioned public API offered by that plugin, runtime capability detection, graceful absence/failure behavior, no mandatory dependency, and no retained foreign instance after that plugin unloads. No cross-plugin integration is authorized by this reference.

## Privacy Considerations

**OFFICIAL OBSIDIAN CONTRACT**

Plugin data is stored in the plugin's `data.json`; official guidance directs plugins to use `loadData`/`saveData` rather than manually managing it. The SecretStorage guide specifically notes that values put in `data.json` are plaintext, so secrets must not be stored there. [Secret storage](https://docs.obsidian.md/plugins/guides/secret-storage)

**MANUSCRIPT COMPILER PROJECT CONVENTION**

The plugin is offline. Persistent history and diagnostics exclude manuscript prose, raw metadata, absolute paths, usernames, Blob URLs, and external destinations. No export is written to the vault.

**IMPLEMENTATION NOTE / INFERENCE**

Saved recipes can reasonably persist necessary configuration and bounded reconciliation evidence, but should not become a second manuscript store. Do not persist prepared prose, serialized `Book`, whole frontmatter, note contents, secret material, or an assumed external destination. The architecture stage must assess which identifiers/settings reveal sensitive project information and whether their persistence is necessary.

## Minimum Obsidian Version Compatibility

**Current repository facts (audited 2026-08-14)**

- `manifest.json` declares `minAppVersion` **1.5.0**.
- `versions.json` maps every released plugin version through **0.10.3** to **1.5.0**.
- Installed development package: `obsidian` **1.13.1** (also the installed TypeScript API typings version).

The future feature's baseline APIs are available at or before 1.5.0: `loadData`/`saveData`, `registerEvent`, Vault discovery/read/events, `MetadataCache.getFileCache` and its change events, `Modal`, imperative `Setting` controls, `Notice`, commands, `file-menu`, and `Workspace.onLayoutReady`. `Vault.getFileByPath` and `getFolderByPath` are specifically typed since 1.5.7, so use `getAbstractFileByPath` plus narrowing for the 1.5.0 baseline.

The current 1.13.1 typings also expose newer APIs that must not become unguarded dependencies: `Plugin.settings` (1.13.0), declarative settings and `Setting.setErrorMessage` (1.13.0), `ButtonComponent.setDestructive` (1.13.0), `Setting.setStatus` (1.13.1), `Vault.appendBinary` (1.12.3), and CLI handlers (1.12.2). Runtime feature detection only helps where an older-compatible fallback is intentional; it does not replace maintaining the declared minimum contract.

## APIs We Should Use

- `Plugin.loadData` / `Plugin.saveData` through one validated persistence boundary.
- `Plugin.onExternalSettingsChange` as an optional reload consideration, subject to architecture and explicit error handling.
- `Vault.getAbstractFileByPath` plus `TFile`/`TFolder` narrowing for persisted-path reconciliation.
- `Vault.getMarkdownFiles`, `Vault.getFiles`, and current scan logic for discovery; `cachedRead`/`read` according to the documented purpose.
- `TFile.stat` only as reconciliation/staleness evidence, never as a permanent identifier.
- `Vault` create/modify/delete/rename and `MetadataCache` changed/deleted events, registered through `registerEvent` and delayed/gated until layout readiness.
- `MetadataCache.getFileCache` with unknown-data validation and null handling.
- Existing imperative `Modal`, `Setting`, standard components, `Notice`, `addCommand`, and `file-menu` APIs.
- `Platform` only for a real UI/platform distinction, not for filesystem branching.

## APIs We Should Avoid

- Direct adapter/file-system access for plugin data or ordinary vault files.
- Electron/Node filesystem APIs, shell/external executables, and desktop-only menu behavior.
- `Vault.getFileByPath` / `getFolderByPath` because they are newer than this plugin's 1.5.0 minimum.
- Deprecated `Workspace.activeLeaf`.
- Declarative settings and other 1.13.x-only convenience APIs unless a later release raises the minimum or supplies a tested dual-compatible route.
- Undocumented plugin-manager internals and foreign private data/settings.
- Treating a path, `ctime`, `mtime`, size, cache event, or metadata cache entry as a complete stable identity guarantee.
- Persisting `TFile`, `TFolder`, prepared `Book`, prose, raw metadata, or secrets.

## Version-Dependent APIs

| API / behavior | Since in installed typings | 1.5.0-compatible direction |
| --- | ---: | --- |
| `Vault.getFileByPath`, `getFolderByPath` | 1.5.7 | Use `getAbstractFileByPath` and narrow. |
| `Plugin.onExternalSettingsChange` | 1.5.7 | Treat as an optional enhancement; do not require it for correctness. |
| `WorkspaceLeaf.loadIfDeferred` | 1.7.2 | Not needed for the existing modal workflow. |
| Declarative `PluginSettingTab` definitions; `Plugin.settings`; validation/error UI helpers | 1.13.0 | Keep imperative `display()`/`Setting` UI. |
| `Setting.setStatus` | 1.13.1 | Use ordinary descriptive text/controls. |
| `Menu.setUseNativeMenu` | desktop only | Do not use. |

## Open Questions for Architecture Stage

1. What minimum non-prose recipe information is needed to restore author intent without serializing manuscript content?
2. Which current paths, parent paths, titles, roles, order evidence, and file stats are necessary and proportionate for reconciliation?
3. How should root rename/move, descendant rename/move, deletion, duplication, and newly discovered files be presented for author review?
4. Should reconciliation be calculated on demand, tracked with events, or both; what batching and scope rules avoid startup and large-vault work?
5. How should externally changed plugin data be reloaded or conflict-checked while a compiler workspace is open?
6. Which mutation boundaries own save failures, repair, atomic UI updates, and a bounded saved-compilation list?
7. How can selection/restore UI remain accessible, keyboard-safe, narrow-pane-safe, and mobile-safe within the current workspace?
8. What explicit, versioned external API—if any—would justify a future optional integration without requiring another plugin?
9. Which recipe fields are sensitive enough to require disclosure, omission, or redaction in diagnostics/history?

## Reference refresh record

This document was prepared on 2026-08-14 from the official Obsidian developer documentation, the official `obsidianmd/obsidian-api` repository, the official `obsidianmd/obsidian-releases` repository, and the repository's installed official `obsidian@1.13.1` typings. No downloaded documentation mirror exists in this repository; the local reference is intentionally a concise, linked, version-aware summary rather than a copied upstream API library.
