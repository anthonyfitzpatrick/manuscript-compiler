# Saved Compilations — Reconciliation Contract

> **Implemented:** pure reconciliation, event-fed potential staleness, active preparation integration, and session-only review resolution. UI remains Part 7.

`reconcileSavedCompilation` accepts a Saved Compilation, an explicitly resolved current root, and the normal current `ContentPlanItem[]`. It does not scan a vault, read prose, persist, or mutate a service. Its output is a copied restored plan, compact observed-source evidence, deterministic findings, statuses, and a readiness level for a later preparation/workspace owner.

## Matching tiers

1. **Exact:** a root-relative saved path matches a current item with the same kind. Its explicit inclusion/role is restored.
2. **Strong rename/move:** the old path is absent, but exactly one compatible current item has the persisted compact fingerprint. It restores intent; a changed parent is a structural review requirement.
3. **Uncertain:** zero or multiple compatible fingerprint candidates. No override is attached. The result reports missing/unresolved state.

Names, basename similarity, Levenshtein distance, Obsidian object identity, and whole-vault searches are never matching evidence.

## Staleness and readiness

Statuses may coexist: `ready`, `source-content-changed`, `structure-changed`, `new-source-items`, `missing-source-items`, `reconciliation-required`, and `unassociated-root`.

- **Ready:** exact-safe restoration, including prose-only source-signature changes.
- **Review recommended:** a new inferred Scene is included under normal current inference; it is visible so new prose is not silently omitted.
- **Review required:** new Chapter/Part/matter-like structure, unresolved/missing references, incompatible roles, moved structure, or incomplete manual order.
- **Blocked:** no explicitly supplied current root. The engine never searches the vault for one.

An explicit saved exclusion is valid author intent, not a reconciliation problem. When an excluded item or excluded container resolves safely, reconciliation restores that state quietly. Its descendants remain effectively excluded without child overrides, and alternative print/eBook/audiobook matter may coexist below one root without becoming findings for the other compilations. Review is reserved for uncertainty that can affect reproduction of the saved output.

Safely identified items beneath a saved exclusion are projected as optional detected content, not faults. The Contents UI keeps that list collapsed; an author may ignore it or choose **Add**. Add uses the normal unsaved Content Plan intent, so **Save changes** is still the only persistence point. Optional detected content never blocks export.

## Order and new items

Saved known included siblings keep their saved relative order. Missing included saved siblings generate a finding while surviving known siblings remain ordered. Excluded siblings do not create ordering conflicts. New siblings retain their current inferred order after known saved siblings; this is deterministic and does not rewrite stored intent. A new ignored item produces no review noise. Unknown unclassified items require review; a new descendant under an explicitly excluded ancestor remains effectively excluded.

## Events and privacy

`SavedCompilationStalenessTracker` is event-fed after layout readiness for vault create/modify/delete/rename events. It only marks saved IDs whose stored root contains the changed path; it performs no scan, reconciliation, persistence, or UI work. Results and observed evidence contain paths/structural/fingerprint facts only—never prose, full frontmatter, destinations, or export bytes. Diagnostics must consume only the service's aggregate summary.
