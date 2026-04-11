import type { GeneratedCredential } from './teacherCredentialExports';

export function sanitizeClassroomCodeForFilename(classroomCode: string) {
  const normalized = classroomCode.trim().toLowerCase();
  if (!/^[a-z0-9_-]{1,32}$/.test(normalized)) {
    return 'classroom';
  }

  return normalized;
}

function parseCsvRows(csv: string) {
  const rows: string[][] = [];
  let cells: string[] = [];
  let value = '';
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];

    if (char === '"') {
      if (inQuotes && csv[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      cells.push(value.trim());
      value = '';
      continue;
    }

    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && csv[index + 1] === '\n') {
        index += 1;
      }

      cells.push(value.trim());
      if (cells.some((cell) => cell.length > 0)) {
        rows.push(cells);
      }
      cells = [];
      value = '';
      continue;
    }

    value += char;
  }

  cells.push(value.trim());
  if (cells.some((cell) => cell.length > 0)) {
    rows.push(cells);
  }

  return rows;
}

export function parseCredentialCsv(csv: string): GeneratedCredential[] {
  const rows = parseCsvRows(csv);

  if (rows.length < 2) {
    return [];
  }

  const header = rows[0] ?? [];
  const aliasIndex = header.indexOf('alias');
  const passcodeIndex = header.indexOf('passcode');

  if (aliasIndex === -1 || passcodeIndex === -1) {
    return [];
  }

  return rows
    .slice(1)
    .map((cells) => ({
      alias: cells[aliasIndex] ?? '',
      passcode: cells[passcodeIndex] ?? '',
    }))
    .filter((entry) => entry.alias.length > 0 && entry.passcode.length > 0);
}
