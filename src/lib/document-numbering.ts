export const COMPANY_CLIENT_CODE = 'SDI-K';
export const CLIENT_CODE_PREFIX = 'K-';

export const ROMAN_MONTHS = [
  'I',
  'II',
  'III',
  'IV',
  'V',
  'VI',
  'VII',
  'VIII',
  'IX',
  'X',
  'XI',
  'XII',
] as const;

export type WorkshopDocumentPrefix =
  | 'QUO'
  | 'SPK'
  | 'SPKS'
  | 'SJI'
  | 'BST'
  | 'INV';

export function toRomanMonth(month: number): string {
  const index = Math.min(11, Math.max(0, Math.round(month) - 1));
  return ROMAN_MONTHS[index] ?? 'I';
}

export function extractMonthAndYearFromDate(dateInput?: string | Date): {
  month: number;
  year: number;
} {
  if (typeof dateInput === 'string') {
    const trimmed = dateInput.trim();
    const isoMatch = /^(\d{4})-(\d{2})/.exec(trimmed);
    if (isoMatch) {
      const year = Number(isoMatch[1]);
      const month = Number(isoMatch[2]);
      if (Number.isFinite(year) && month >= 1 && month <= 12) {
        return { year, month };
      }
    }
    if (trimmed) {
      const parsed = new Date(trimmed);
      if (Number.isFinite(parsed.getTime())) {
        return {
          year: parsed.getFullYear(),
          month: parsed.getMonth() + 1,
        };
      }
    }
  } else if (dateInput instanceof Date && Number.isFinite(dateInput.getTime())) {
    return {
      year: dateInput.getFullYear(),
      month: dateInput.getMonth() + 1,
    };
  }

  const now = new Date();
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  };
}

export function parseClientSequence(code?: string | number | null): number | null {
  if (typeof code === 'number') {
    return Number.isFinite(code) && code > 0 ? Math.floor(code) : null;
  }
  const raw = String(code ?? '').trim();
  if (!raw) return null;
  const clientCodeMatch = /^k-(\d+)(?:-\d+)?$/i.exec(raw);
  if (clientCodeMatch) {
    const num = Number(clientCodeMatch[1]);
    return Number.isFinite(num) && num > 0 ? num : null;
  }
  const trailingDigits = /(\d+)$/.exec(raw);
  if (!trailingDigits) return null;
  const num = Number(trailingDigits[1]);
  return Number.isFinite(num) && num > 0 ? num : null;
}

export function formatClientCode(seq: number, minDigits: number = 3): string {
  const safeSeq = Math.max(1, Math.floor(Number.isFinite(seq) ? seq : 1));
  return `${CLIENT_CODE_PREFIX}${String(safeSeq).padStart(minDigits, '0')}`;
}

export function stripClientCodePrefix(
  clientCodeOrSeq?: string | number | null,
  minDigits: number = 3
): string {
  const parsed = parseClientSequence(clientCodeOrSeq);
  if (parsed !== null) {
    return String(parsed).padStart(minDigits, '0');
  }
  return String(1).padStart(minDigits, '0');
}

export function resolveNextClientSequence(
  contacts: ReadonlyArray<{ kodeKlien?: string }>,
  projects: ReadonlyArray<{ id?: string }> = []
): number {
  let maxSeq = 0;
  for (const contact of contacts) {
    const seq = parseClientSequence(contact.kodeKlien);
    if (seq !== null && seq > maxSeq) {
      maxSeq = seq;
    }
  }
  for (const project of projects) {
    const seq = parseClientSequence(project.id);
    if (seq !== null && seq > maxSeq) {
      maxSeq = seq;
    }
  }
  return Math.max(contacts.length, maxSeq) + 1;
}

export function resolveNextClientCode(
  contacts: ReadonlyArray<{ kodeKlien?: string }>,
  projects: ReadonlyArray<{ id?: string }> = []
): string {
  return formatClientCode(resolveNextClientSequence(contacts, projects));
}

export const LEGACY_SEEDED_PROJECT_ID_MAP: Readonly<Record<string, string>> = {
  'prj-001': 'K-003',
  'prj-002': 'K-005',
  'prj-003': 'K-002',
  'prj-004': 'K-004',
  'prj-005': 'K-001',
};

export function migrateLegacyProjectId(projectId?: string): string | undefined {
  if (!projectId) return projectId;
  return LEGACY_SEEDED_PROJECT_ID_MAP[projectId] ?? projectId;
}

export function resolveProjectIdFromClientCode(
  clientCode: string,
  existingProjects: ReadonlyArray<{ id: string }> = []
): string {
  const normalized = clientCode.trim().toUpperCase();
  const baseId = normalized || formatClientCode(1);
  const existingIds = new Set(existingProjects.map((item) => item.id.trim().toUpperCase()));
  if (!existingIds.has(baseId)) {
    return baseId;
  }
  let suffix = 2;
  while (existingIds.has(`${baseId}-${suffix}`)) {
    suffix += 1;
  }
  return `${baseId}-${suffix}`;
}

export function resolveProjectClientDigits(
  project: { id?: string },
  fallbackSeq: number = 1
): string {
  const idSeq = parseClientSequence(project.id);
  if (idSeq !== null) {
    return String(idSeq).padStart(3, '0');
  }
  return stripClientCodePrefix(fallbackSeq);
}

export function formatWorkshopDocumentNumber(
  docPrefix: WorkshopDocumentPrefix,
  options: {
    clientCodeOrSeq?: string | number | null;
    date?: string | Date;
    companyClientCode?: string;
  } = {}
): string {
  const companyCode = (options.companyClientCode ?? COMPANY_CLIENT_CODE).trim() || COMPANY_CLIENT_CODE;
  const clientDigits = stripClientCodePrefix(options.clientCodeOrSeq);
  const { month, year } = extractMonthAndYearFromDate(options.date);
  const romanMonth = toRomanMonth(month);
  return `${docPrefix}/${companyCode}/${clientDigits}/${romanMonth}/${year}`;
}

export function formatTerminDocumentNumber(
  invoiceNumber: string,
  stageIndex: number,
  fallbackOptions?: {
    clientCodeOrSeq?: string | number | null;
    date?: string | Date;
    companyClientCode?: string;
  }
): string {
  const stageNum = Math.max(1, Math.floor(stageIndex) + 1);
  const trimmed = invoiceNumber.trim();
  if (trimmed.includes('/')) {
    const parts = trimmed.split('/');
    parts[0] = `INV-T${stageNum}`;
    return parts.join('/');
  }
  if (fallbackOptions?.clientCodeOrSeq !== undefined) {
    const companyCode =
      (fallbackOptions.companyClientCode ?? COMPANY_CLIENT_CODE).trim() || COMPANY_CLIENT_CODE;
    const clientDigits = stripClientCodePrefix(fallbackOptions.clientCodeOrSeq);
    const { month, year } = extractMonthAndYearFromDate(fallbackOptions.date);
    return `INV-T${stageNum}/${companyCode}/${clientDigits}/${toRomanMonth(month)}/${year}`;
  }
  return trimmed ? `${trimmed}-T${stageNum}` : `INV-T${stageNum}`;
}

export function isSpkDocumentNumber(value?: string | null): boolean {
  const normalized = (value ?? '').trim().toUpperCase();
  return (
    normalized.startsWith('SPK/') ||
    normalized.startsWith('SPK-') ||
    normalized.startsWith('SPKS/') ||
    normalized.startsWith('SPKS-')
  );
}

export function sanitizeNumberForFilename(value: string): string {
  return value
    .trim()
    .replace(/[/\\:*?"<>|\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}
