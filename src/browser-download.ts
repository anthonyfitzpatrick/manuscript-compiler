/** One platform-neutral Blob download path for every completed export. */
export interface DownloadFileRequest { filename: string; bytes: Uint8Array; mimeType: string; }
export interface DownloadFileResult { started: boolean; filename: string; error?: string; }
export interface DownloadEnvironment {
  createObjectURL(blob: Blob): string; revokeObjectURL(url: string): void;
  createAnchor(): HTMLAnchorElement; append(anchor: HTMLAnchorElement): void;
  defer(action: () => void): void;
}

export class BrowserDownloadService {
  constructor(private readonly environment: DownloadEnvironment = browserEnvironment()) {}
  async download(request: DownloadFileRequest): Promise<DownloadFileResult> {
    const filename = safeLeaf(request.filename); let url = ""; let anchor: HTMLAnchorElement | undefined; let clicked = false;
    try {
      const copy = request.bytes.slice(); const blob = new Blob([copy], { type: request.mimeType }); url = this.environment.createObjectURL(blob); anchor = this.environment.createAnchor(); anchor.href = url; anchor.download = filename; anchor.style.display = "none"; this.environment.append(anchor); anchor.click(); clicked = true; return { started: true, filename };
    } catch (error) { return { started: false, filename, error: error instanceof Error ? error.message : "The host blocked the download." }; }
    finally { anchor?.remove(); if (url) { if (clicked) this.environment.defer(() => this.environment.revokeObjectURL(url)); else this.environment.revokeObjectURL(url); } }
  }
}

function browserEnvironment(): DownloadEnvironment { return { createObjectURL: (blob) => URL.createObjectURL(blob), revokeObjectURL: (url) => URL.revokeObjectURL(url), createAnchor: () => document.createElement("a"), append: (anchor) => document.body.appendChild(anchor), defer: (action) => window.setTimeout(action, 1000) }; }
function safeLeaf(value: string): string { let leaf = value.replace(/^.*[\\/]/, "").replace(/[\u0000-\u001f\u007f\\/:*?"<>|]/g, "-").trim().replace(/[. ]+$/g, ""); if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(leaf)) leaf = `_${leaf}`; return leaf || "Manuscript"; }
