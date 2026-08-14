# Saved Compilations Schema

> **Status: schema-1 persistence is implemented and used by the completed internal Part 6 lifecycle.**

## Storage location and schema

Saved Compilations live in the existing plugin data.json settings object, not a second persistence subsystem. The collection has an independent schema version (**1**) so it can evolve independently of the plugin version.

Schema 1 is a JSON-safe envelope containing a bounded array of entries. Each retained entry has an immutable local ID, a non-empty relative manuscript-root path, a non-empty display name, a validated output configuration, a normalized recipe, and compact observed-state facts.

## Domain versus storage

The runtime domain model and persisted storage model currently share only plain-object values. The persistence boundary returns already repaired, strongly typed domain state. Later services must not attach TFile, TFolder, Book, cache objects, DOM objects, dates, maps, sets, blobs, functions, or raw loaded objects.

## Identity and timestamps

Each recipe has an immutable ID independent of display name and root path. New IDs use crypto.randomUUID() where available, with a platform-neutral timestamp/random fallback; neither needs a dependency or network service. Duplicate stored IDs retain the first valid entry and deterministically suffix later valid IDs.

Times are finite non-negative Unix milliseconds. Schema 1 records creation, modification, optional last-opened, and optional last successful validated browser-dispatch facts. It never claims that an external output file exists.

## Root and item references

The root stores a normalized vault-relative path. It is valid even when it no longer resolves: that is an unassociated manuscript, not corruption. Paths reject absolute forms, drive prefixes, traversal, empty segments, control characters, and excessive length.

Each optional item reference stores only last known relative path, parent-relative path, display name, expected file/folder kind, expected role, and an optional compact fingerprint. This is conservative evidence for Part 5, not a permanent file ID and not a fuzzy matcher. Full note content, frontmatter, metadata cache entries, and filesystem identifiers are excluded.

## Recipe and manual order

The recipe persists only author-authoritative choices: explicit inclusion/exclusion and role overrides; compact manual sibling-order lists keyed by the parent whose order changed; and resolved structural/cleaning/filter choices required to reproduce a compilation.

Automatic scanner inference, warnings, excluded-file explanations, and derived physical trees are not saved. Missing override/order references are retained for later reconciliation, subject to bounds.

## Output configuration

Schema 1 records the selected current exporter, filename, resolved DOCX preset, title/author overrides, TOC, scene separator, Part/Chapter presentation, title page, optional typography, and optional profile-origin ID. It records current supported cleaning/structural settings rather than a pointer to a mutable profile. A future profile edit cannot alter a saved recipe.

Format is validated against the six current exporters. Typography is a compact current formatting snapshot, not an exporter-byte cache. Filename is portable only, never a destination path.

## Observed source and export facts

Observed state can retain bounded source fingerprint, input signature, and compact item-reference evidence. Last successful export can retain timestamp, format, source fingerprint, input signature, and recipe signature. These support later stale/export-current displays; they do not contain prose or a destination.

The deterministic recipe signature/equality helper compares root, normalized recipe, and output only. It excludes observed source data, export facts, and timestamps, so a source edit does not make a workspace recipe dirty.

## Limits

| Value | Schema-1 bound | Reason |
| --- | ---: | --- |
| Saved Compilations | 500 | Corruption/DoS guard, far beyond normal author use. |
| References/overrides per recipe | 10,000 | Supports unusually large manuscripts while bounding load work. |
| Manual-order records per recipe | 10,000 | Same large-project safety margin. |
| Name / description | 200 / 2,000 characters | Usable labels/notes without unbounded UI storage. |
| Relative path | 4,096 characters | Generous vault-path limit while rejecting pathological input. |
| Filename | 255 characters | Portable filename safety. |
| Filters / aliases | 100 / 50 | Matches existing profile safety philosophy. |

Repair processes only recognized schema paths and slices bounded arrays before per-entry work. It is linear in retained data and scans no manuscript files.

## Validation, repair, and migration

Loaded state follows:

    unknown → structural validation → schema migration gate → per-entry repair → typed domain state

Schema 1 has no historical transform yet, but the collection version gate is the migration framework for a later explicit 1 → 2 migration. A claimed schema newer than 1 is isolated as unsupported and never reinterpreted as schema 1. Other settings remain usable. A malformed entry drops only itself; valid siblings survive. Missing optional values receive safe defaults only where that cannot claim an author choice.

Repair rejects or strips unsupported enums, invalid paths, malformed booleans/numbers/objects, oversized values, duplicate nested references, impossible filenames, and unsafe metadata-filter values. It builds fresh plain objects and never copies arbitrary keys, mitigating prototype-pollution and data-bloat risks.

## Runtime storage ownership

Schema-1 entries are accessed and mutated only through `SavedCompilationService`. It validates every service input through the schema repair boundary, returns structured non-sensitive failures, and serializes writes through the existing full-settings save callback. A newer unsupported envelope is not converted to schema 1: it remains raw settings data and the service declines mutations until a compatible migration exists.

## Privacy exclusions

Schema 1 must not retain manuscript prose, paragraphs, prepared Books, parsed documents, full YAML/frontmatter, MetadataCache, exported bytes, Blob URLs, absolute paths, external destinations, images, secrets, or arbitrary unknown payloads. Relative paths/names/fingerprints are sensitive and remain absent from diagnostics/support exports.

## Synthetic schema-1 example

    {
      "schemaVersion": 1,
      "entries": [{
        "id": "saved-example-001",
        "name": "Editor DOCX",
        "createdAt": 1760000000000,
        "modifiedAt": 1760000100000,
        "root": { "path": "Books/Example" },
        "recipe": {
          "overrides": [{
            "reference": {
              "path": "Chapter 1/Scene 1.md",
              "parentPath": "Chapter 1",
              "name": "Scene 1.md",
              "kind": "note",
              "expectedRole": "scene"
            },
            "included": false,
            "role": "ignore"
          }],
          "manualOrders": [],
          "structurePreset": "novel",
          "includeFrontMatter": true,
          "includeBackMatter": false,
          "includeSceneTitles": false,
          "cleaning": { "stripYamlFrontmatter": true, "removeObsidianComments": true, "removeHtmlComments": false, "removeDataviewBlocks": false, "removeCallouts": false, "stripInternalLinks": false, "bodySectionAliases": ["Scene"] },
          "metadataFilters": [],
          "useParts": false,
          "chapterSource": "folders",
          "orderingMethod": "filename",
          "metadataOrdering": false,
          "partHeadingTemplate": "{title}",
          "chapterHeadingTemplate": "Chapter {number}",
          "blankLinesBetweenSections": 1,
          "blankLinesBetweenChapters": 1
        },
        "output": {
          "format": "docx",
          "filename": "Example.docx",
          "docxPreset": "vellum",
          "title": "Example",
          "author": "Author",
          "tableOfContents": false,
          "sceneSeparator": "#",
          "partDisplay": "word-title",
          "chapterDisplay": "word-title",
          "titlePage": false
        },
        "observedSource": { "references": [] }
      }]
    }
