import type { PreparedCompileSession, PreparedExclusion } from "../compile-preparation";
import type { CompileWarning, ManuscriptStatistics } from "../model";
import { numberWord } from "../ordering";
import type { StructuralDisplay } from "../settings";

export interface PreviewMatterItem { title: string; }
export interface PreviewChapterItem { title: string; sceneCount: number; }
export interface PreviewPartItem { title: string; chapters: PreviewChapterItem[]; }
export interface ExportPreviewViewModel {
  book: PreparedCompileSession["book"];
  title: string;
  titlePage: boolean;
  frontMatter: PreviewMatterItem[];
  parts: PreviewPartItem[];
  looseChapters: PreviewChapterItem[];
  backMatter: PreviewMatterItem[];
  statistics: ManuscriptStatistics;
  warnings: CompileWarning[];
  exclusions: PreparedExclusion[];
  outputPath: string;
}

export function buildExportPreviewViewModel(session: PreparedCompileSession): ExportPreviewViewModel {
  const profile = session.profile;
  const matter = (documents: typeof session.book.frontMatter.documents, enabled: boolean): PreviewMatterItem[] => enabled
    ? documents.filter((item) => !item.excluded && item.content.trim()).map((item) => ({ title: item.title }))
    : [];
  const chapter = (item: typeof session.book.parts[number]["chapters"][number]): PreviewChapterItem => ({
    title: structuralHeading("Chapter", item, profile.chapterDisplay ?? "word-title"),
    sceneCount: item.scenes.filter((scene) => !scene.excluded && scene.content.trim()).length
  });
  const parts: PreviewPartItem[] = [];
  const looseChapters: PreviewChapterItem[] = [];
  session.book.parts.forEach((part) => {
    if (profile.useParts && !part.synthetic) parts.push({ title: structuralHeading("Part", part, profile.partDisplay ?? "word-title"), chapters: part.chapters.map(chapter) });
    else looseChapters.push(...part.chapters.map(chapter));
  });
  return {
    book: session.book,
    title: profile.variables.BookTitle || session.book.title,
    titlePage: profile.docxTitlePage === true,
    frontMatter: matter(session.book.frontMatter.documents, profile.includeFrontMatter),
    parts,
    looseChapters,
    backMatter: matter(session.book.backMatter.documents, profile.includeBackMatter),
    statistics: session.statistics,
    warnings: session.warnings,
    exclusions: session.exclusions,
    outputPath: session.outputPaths[0] ?? ""
  };
}

function structuralHeading(kind: "Part" | "Chapter", item: { title: string; name: string; number?: number }, display: StructuralDisplay): string {
  const numeric = item.number === undefined ? kind : `${kind} ${item.number}`;
  const word = item.number === undefined ? kind : `${kind} ${numberWord(item.number)}`;
  const title = item.name || item.title;
  if (display === "word") return item.number === undefined ? title : word;
  if (display === "numeric") return item.number === undefined ? title : numeric;
  if (display === "title" || display === "custom") return title;
  if (display === "numeric-title") return item.number === undefined ? title : `${numeric} — ${title}`;
  return item.number === undefined ? title : `${word} — ${title}`;
}
