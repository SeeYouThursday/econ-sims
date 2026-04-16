export type GeneratedCredential = {
  alias: string;
  passcode: string;
};

type PrintPopupLike = Pick<Window, 'document' | 'location' | 'focus' | 'print'>;
type UrlApi = Pick<typeof URL, 'createObjectURL' | 'revokeObjectURL'>;
type PopupEventApi = {
  addEventListener?: (event: string, listener: () => void) => void;
  removeEventListener?: (event: string, listener: () => void) => void;
};

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function sanitizeCsvCell(value: string) {
  // Prevent spreadsheet formula execution when opening CSV in Excel/Sheets.
  if (/^[\s\t]*[=+\-@]/.test(value)) {
    return `'${value}`;
  }

  return value;
}

function escapeCsv(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined) {
    return '';
  }

  const sanitized = sanitizeCsvCell(String(value));
  if (
    sanitized.includes(',') ||
    sanitized.includes('"') ||
    sanitized.includes('\n') ||
    sanitized.includes('\r')
  ) {
    return `"${sanitized.replaceAll('"', '""')}"`;
  }

  return sanitized;
}

export function toCredentialsCsv(
  classroomCode: string,
  credentials: GeneratedCredential[],
) {
  const header = ['classroomCode', 'alias', 'passcode'];
  const rows = credentials.map((entry) => [
    classroomCode,
    entry.alias,
    entry.passcode,
  ]);
  return [header, ...rows]
    .map((row) => row.map((cell) => escapeCsv(cell)).join(','))
    .join('\n');
}

export function buildCredentialCardsHtml(
  classroomCode: string,
  credentials: GeneratedCredential[],
) {
  const cardsMarkup = credentials
    .map(
      (entry) => `
        <article class="card">
          <p class="label">Class code</p>
          <p class="value">${escapeHtml(classroomCode)}</p>
          <p class="label">Alias</p>
          <p class="value">${escapeHtml(entry.alias)}</p>
          <p class="label">Passcode</p>
          <p class="value">${escapeHtml(entry.passcode)}</p>
        </article>
      `,
    )
    .join('');

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Student Credentials</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 1rem; color: #0f172a; }
          h1 { font-size: 1.1rem; margin: 0 0 0.25rem 0; }
          p.meta { margin: 0 0 1rem 0; font-size: 0.82rem; color: #334155; }
          .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.65rem; }
          .card { border: 1px dashed #334155; border-radius: 10px; padding: 0.6rem; break-inside: avoid; }
          .label { margin: 0.15rem 0 0; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.07em; color: #64748b; }
          .value { margin: 0.12rem 0; font-size: 1rem; font-weight: 700; }
          @media print { body { margin: 0.5rem; } }
        </style>
      </head>
      <body>
        <h1>Student Credential Cards</h1>
        <p class="meta">Classroom ${escapeHtml(classroomCode)} &bull; ${credentials.length} students</p>
        <section class="grid">${cardsMarkup}</section>
        <!-- print triggered by parent window after document.close() -->
      </body>
    </html>
  `;
}

export function writeAndPrintCredentialCards(
  popup: PrintPopupLike & PopupEventApi,
  classroomCode: string,
  credentials: GeneratedCredential[],
  delayMs = 400,
  schedule: (callback: () => void, delay: number) => unknown = setTimeout,
  urlApi: UrlApi = URL,
) {
  const html = buildCredentialCardsHtml(classroomCode, credentials);
  let cleanupBlobUrl: string | null = null;
  let hasTriggeredPrint = false;

  const cleanup = () => {
    if (cleanupBlobUrl) {
      urlApi.revokeObjectURL(cleanupBlobUrl);
      cleanupBlobUrl = null;
    }
  };

  const triggerPrint = () => {
    if (hasTriggeredPrint) {
      return;
    }

    hasTriggeredPrint = true;
    popup.focus();
    popup.print();
    cleanup();
  };

  const handleLoad = () => {
    popup.removeEventListener?.('load', handleLoad);
    triggerPrint();
  };

  try {
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
  } catch {
    // Some browser/extension combinations block document.open/write on popups.
    // Fallback: navigate popup to a blob-backed HTML document.
    const blob = new Blob([html], { type: 'text/html' });
    cleanupBlobUrl = urlApi.createObjectURL(blob);
    popup.location.href = cleanupBlobUrl;
  }

  popup.addEventListener?.('load', handleLoad);
  schedule(triggerPrint, delayMs + (cleanupBlobUrl ? 600 : 0));
}
