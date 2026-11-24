import paymentSchemeJson from '../data/skema-pembayaran.json';
import type { PaymentSchemeConfig, PaymentSchemeStage } from '../types/cms';

export const DEFAULT_PAYMENT_SCHEME: PaymentSchemeConfig =
  paymentSchemeJson as PaymentSchemeConfig;

export interface PaymentSchemeBreakdownItem extends PaymentSchemeStage {
  amount: number | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function sanitizePaymentScheme(
  raw: unknown,
  fallback: PaymentSchemeConfig = DEFAULT_PAYMENT_SCHEME
): PaymentSchemeConfig {
  if (!isRecord(raw)) {
    return structuredClone(fallback);
  }

  const judul =
    typeof raw.judul === 'string' && raw.judul.trim().length > 0
      ? raw.judul.trim()
      : fallback.judul;
  const catatan =
    typeof raw.catatan === 'string' ? raw.catatan.trim() : fallback.catatan;

  const rawStages = Array.isArray(raw.tahapan) ? raw.tahapan : [];
  const parsedStages: PaymentSchemeStage[] = [];

  for (let i = 0; i < rawStages.length; i += 1) {
    const item = rawStages[i];
    if (!isRecord(item)) continue;
    const nama = typeof item.nama === 'string' ? item.nama.trim() : '';
    const keterangan = typeof item.keterangan === 'string' ? item.keterangan.trim() : '';
    const rawPct = typeof item.persentase === 'number' ? item.persentase : Number(item.persentase);
    if (!nama || !Number.isFinite(rawPct) || rawPct < 0 || rawPct > 100) continue;

    parsedStages.push({
      id:
        typeof item.id === 'string' && item.id.trim().length > 0
          ? item.id.trim()
          : `termin-${i + 1}`,
      urutan:
        typeof item.urutan === 'number' && Number.isFinite(item.urutan)
          ? item.urutan
          : i + 1,
      nama,
      persentase: Math.round(rawPct * 100) / 100,
      keterangan,
    });
  }

  if (parsedStages.length === 0) {
    return structuredClone(fallback);
  }

  const ordered = [...parsedStages]
    .sort((a, b) => a.urutan - b.urutan)
    .map((stage, idx) => ({ ...stage, urutan: idx + 1 }));

  return {
    judul,
    catatan,
    tahapan: ordered,
  };
}

export function computePaymentSchemeTotalPercent(
  stages: readonly Pick<PaymentSchemeStage, 'persentase'>[]
): number {
  const sum = stages.reduce(
    (acc, stage) => acc + (Number.isFinite(stage.persentase) ? stage.persentase : 0),
    0
  );
  return Math.round(sum * 100) / 100;
}

export function resolvePaymentSchemeDpPercentage(
  scheme?: PaymentSchemeConfig | null,
  fallbackPercent = 30
): number {
  const firstStage = scheme?.tahapan?.[0];
  if (
    firstStage &&
    typeof firstStage.persentase === 'number' &&
    Number.isFinite(firstStage.persentase) &&
    firstStage.persentase > 0 &&
    firstStage.persentase <= 100
  ) {
    return firstStage.persentase;
  }
  return fallbackPercent;
}

export function calculatePaymentSchemeBreakdown(
  totalAmount: number | null | undefined,
  scheme: PaymentSchemeConfig = DEFAULT_PAYMENT_SCHEME
): PaymentSchemeBreakdownItem[] {
  const orderedStages = [...(scheme.tahapan ?? [])]
    .sort((a, b) => a.urutan - b.urutan);

  if (typeof totalAmount !== 'number' || !Number.isFinite(totalAmount) || totalAmount <= 0) {
    return orderedStages.map((stage) => ({
      ...stage,
      amount: null,
    }));
  }

  const roundedTotal = Math.round(totalAmount);
  const totalPct = computePaymentSchemeTotalPercent(orderedStages);
  const exactSumTarget = Math.abs(totalPct - 100) < 0.01;
  let allocatedSoFar = 0;

  return orderedStages.map((stage, idx) => {
    const isLast = idx === orderedStages.length - 1;
    const amount =
      exactSumTarget && isLast
        ? Math.max(0, roundedTotal - allocatedSoFar)
        : Math.round((roundedTotal * stage.persentase) / 100);
    allocatedSoFar += amount;
    return {
      ...stage,
      amount,
    };
  });
}

export function formatPaymentSchemeSummary(
  scheme: PaymentSchemeConfig = DEFAULT_PAYMENT_SCHEME
): string {
  const ordered = [...(scheme.tahapan ?? [])].sort((a, b) => a.urutan - b.urutan);
  if (ordered.length === 0) return '';
  return ordered
    .map((stage) => `${stage.nama} ${stage.persentase}% (${stage.keterangan.replace(/\.$/, '')})`)
    .join(' · ');
}

export function clonePaymentSchemeStages(
  scheme?: PaymentSchemeConfig | null
): PaymentSchemeStage[] {
  const resolved =
    scheme && Array.isArray(scheme.tahapan) && scheme.tahapan.length > 0
      ? scheme
      : DEFAULT_PAYMENT_SCHEME;
  return [...resolved.tahapan]
    .sort((a, b) => a.urutan - b.urutan)
    .map((stage, idx) => ({
      ...stage,
      urutan: idx + 1,
    }));
}

export function resolveEffectivePaymentScheme(
  stages?: readonly PaymentSchemeStage[] | null,
  fallbackScheme: PaymentSchemeConfig = DEFAULT_PAYMENT_SCHEME,
  customNote?: string
): PaymentSchemeConfig {
  if (Array.isArray(stages) && stages.length > 0) {
    return sanitizePaymentScheme(
      {
        judul: fallbackScheme.judul,
        catatan: customNote?.trim() || fallbackScheme.catatan,
        tahapan: stages,
      },
      fallbackScheme
    );
  }
  return sanitizePaymentScheme(fallbackScheme, DEFAULT_PAYMENT_SCHEME);
}

export function deriveLegacyThreeStagePercentages(
  stages: readonly PaymentSchemeStage[]
): {
  persenDp: number;
  persenProgres: number;
  persenPelunasan: number;
} {
  const ordered = [...stages].sort((a, b) => a.urutan - b.urutan);
  if (ordered.length === 0) {
    return { persenDp: 30, persenProgres: 60, persenPelunasan: 10 };
  }
  if (ordered.length === 1) {
    return { persenDp: Math.round(ordered[0].persentase), persenProgres: 0, persenPelunasan: 0 };
  }
  const persenDp = Math.round(ordered[0].persentase);
  const persenPelunasan = Math.round(ordered[ordered.length - 1].persentase);
  const middleSum = ordered
    .slice(1, -1)
    .reduce((sum, stage) => sum + stage.persentase, 0);
  return {
    persenDp,
    persenProgres: Math.round(middleSum),
    persenPelunasan,
  };
}

export function buildAgreementPaymentClauseText(
  stages: readonly PaymentSchemeStage[],
  note?: string
): string {
  const ordered = [...stages].sort((a, b) => a.urutan - b.urutan);
  if (ordered.length === 0) {
    return 'Pembayaran dilakukan bertahap sesuai kesepakatan kontrak dan rekening resmi workshop.';
  }
  const stageList = ordered
    .map(
      (stage) =>
        `${stage.nama} sebesar ${stage.persentase}% (${stage.keterangan.replace(/\.$/, '')})`
    )
    .join('; ');
  const suffix = note?.trim() ? ` ${note.trim()}` : '';
  return `Total nilai pekerjaan disepakati sebesar nilai kontrak tercantum dengan sistem pembayaran bertahap sesuai skema resmi workshop: ${stageList}.${suffix}`;
}

export type EvaluatedPaymentStageStatus = 'Lunas' | 'Sebagian' | 'Belum Dibayar';

export interface EvaluatedPaymentStage extends PaymentSchemeStage {
  targetAmount: number;
  paidAmount: number;
  remainingAmount: number;
  progressPercent: number;
  status: EvaluatedPaymentStageStatus;
}

export interface EvaluatedInvoicePaymentSchedule {
  scheme: PaymentSchemeConfig;
  totalContract: number;
  totalPaid: number;
  remainingTotal: number;
  stages: EvaluatedPaymentStage[];
  nextStage: EvaluatedPaymentStage | null;
  finalStage: EvaluatedPaymentStage | null;
}

export function evaluateInvoicePaymentSchedule(
  totalContract: number,
  payments: readonly { nominal: number }[],
  scheme: PaymentSchemeConfig = DEFAULT_PAYMENT_SCHEME
): EvaluatedInvoicePaymentSchedule {
  const cleanTotal = Math.max(0, Math.round(Number.isFinite(totalContract) ? totalContract : 0));
  const totalPaid = payments.reduce(
    (sum, item) => sum + Math.max(0, Math.round(Number.isFinite(item.nominal) ? item.nominal : 0)),
    0
  );
  const breakdown = calculatePaymentSchemeBreakdown(cleanTotal, scheme);

  let remainingPool = totalPaid;
  const stages: EvaluatedPaymentStage[] = breakdown.map((stage) => {
    const targetAmount = Math.max(0, stage.amount ?? 0);
    const paidAmount = Math.min(targetAmount, remainingPool);
    remainingPool = Math.max(0, remainingPool - paidAmount);
    const remainingAmount = Math.max(0, targetAmount - paidAmount);
    const progressPercent =
      targetAmount > 0 ? Math.min(100, Math.round((paidAmount / targetAmount) * 100)) : 0;

    let status: EvaluatedPaymentStageStatus = 'Belum Dibayar';
    if (targetAmount > 0 && remainingAmount === 0) {
      status = 'Lunas';
    } else if (paidAmount > 0) {
      status = 'Sebagian';
    }

    return {
      id: stage.id,
      urutan: stage.urutan,
      nama: stage.nama,
      persentase: stage.persentase,
      keterangan: stage.keterangan,
      targetAmount,
      paidAmount,
      remainingAmount,
      progressPercent,
      status,
    };
  });

  const nextStage = stages.find((s) => s.remainingAmount > 0) ?? null;
  const finalStage = stages.length > 0 ? stages[stages.length - 1] : null;

  return {
    scheme,
    totalContract: cleanTotal,
    totalPaid,
    remainingTotal: Math.max(0, cleanTotal - totalPaid),
    stages,
    nextStage,
    finalStage,
  };
}

export interface StageReceivableSummary {
  stageId: string;
  urutan: number;
  nama: string;
  persentase: number;
  keterangan: string;
  totalTarget: number;
  totalCollected: number;
  totalRemaining: number;
  pendingInvoiceCount: number;
}

export function computeFinanceScheduleSummary(
  invoices: readonly {
    nilaiTotalKontrak: number;
    riwayatPembayaran: readonly { nominal: number }[];
    skemaPembayaran?: PaymentSchemeStage[];
  }[],
  fallbackScheme: PaymentSchemeConfig = DEFAULT_PAYMENT_SCHEME
): StageReceivableSummary[] {
  const orderedFallback = clonePaymentSchemeStages(fallbackScheme);
  const stageBuckets = new Map<string, StageReceivableSummary>();

  for (const stage of orderedFallback) {
    stageBuckets.set(stage.id, {
      stageId: stage.id,
      urutan: stage.urutan,
      nama: stage.nama,
      persentase: stage.persentase,
      keterangan: stage.keterangan,
      totalTarget: 0,
      totalCollected: 0,
      totalRemaining: 0,
      pendingInvoiceCount: 0,
    });
  }

  for (const inv of invoices) {
    const effective = resolveEffectivePaymentScheme(inv.skemaPembayaran, fallbackScheme);
    const evaluated = evaluateInvoicePaymentSchedule(
      inv.nilaiTotalKontrak,
      inv.riwayatPembayaran,
      effective
    );

    for (const st of evaluated.stages) {
      const existing = stageBuckets.get(st.id);
      if (existing) {
        existing.totalTarget += st.targetAmount;
        existing.totalCollected += st.paidAmount;
        existing.totalRemaining += st.remainingAmount;
        if (st.remainingAmount > 0) {
          existing.pendingInvoiceCount += 1;
        }
      } else {
        stageBuckets.set(st.id, {
          stageId: st.id,
          urutan: st.urutan,
          nama: st.nama,
          persentase: st.persentase,
          keterangan: st.keterangan,
          totalTarget: st.targetAmount,
          totalCollected: st.paidAmount,
          totalRemaining: st.remainingAmount,
          pendingInvoiceCount: st.remainingAmount > 0 ? 1 : 0,
        });
      }
    }
  }

  return Array.from(stageBuckets.values()).sort((a, b) => a.urutan - b.urutan);
}

