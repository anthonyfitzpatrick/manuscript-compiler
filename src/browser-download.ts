/** One platform-neutral Blob download path for every completed export. */
export interface DownloadFileRequest { filename: string; bytes: Uint8Array; mimeType: string; }
export interface DownloadFileResult { started: boolean; filename: string; error?: string; }
export interface DownloadEnvironment {
  createObjectURL(blob: Blob, anchor: HTMLAnchorElement): string; revokeObjectURL(url: string, anchor: HTMLAnchorElement): void;
  createAnchor(): HTMLAnchorElement; append(anchor: HTMLAnchorElement): void;
  defer(action: () => void, anchor: HTMLAnchorElement): void;
}

export class BrowserDownloadService {
  constructor(private readonly environment: DownloadEnvironment = browserEnvironment()) {}
  async download(request: DownloadFileRequest): Promise<DownloadFileResult> {
    const filename = safeLeaf(request.filename); let url = ""; let anchor: HTMLAnchorElement | undefined; let clicked = false;
    try {
      const copy = request.bytes.slice(); const blob = new Blob([copy], { type: request.mimeType }); anchor = this.environment.createAnchor(); url = this.environment.createObjectURL(blob, anchor); anchor.href = url; anchor.download = filename; anchor.addClass("manuscript-download-anchor"); this.environment.append(anchor); anchor.click(); clicked = true; return { started: true, filename };
    } catch { return { started: false, filename, error: "The host blocked the download. Try again or use the platform share or save controls." }; }
    finally { anchor?.remove(); if (url && anchor) { const cleanupAnchor = anchor; if (clicked) this.environment.defer(() => this.environment.revokeObjectURL(url, cleanupAnchor), cleanupAnchor); else this.environment.revokeObjectURL(url, cleanupAnchor); } }
  }
}

function browserEnvironment(): DownloadEnvironment { return { createObjectURL: (blob) => URL.createObjectURL(blob), revokeObjectURL: (url) => URL.revokeObjectURL(url), createAnchor: () => createEl("a"), append: (anchor) => anchor.doc.body.appendChild(anchor), defer: (action, anchor) => anchor.win.setTimeout(action, 1000) }; }
function safeLeaf(value: string): string { let leaf = replaceUnsafeFilenameCharacters(value.replace(/^.*[\\/]/, "")).trim().replace(/[. ]+$/g, ""); if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(leaf)) leaf = `_${leaf}`; return leaf || "Manuscript"; }
function replaceUnsafeFilenameCharacters(value: string): string { return [...value].map((character) => { const code = character.charCodeAt(0); return code <= 0x1f || code === 0x7f || '\\/:*?"<>|'.includes(character) ? "-" : character; }).join(""); }
