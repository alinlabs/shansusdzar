import type {
  MarketingCampaign,
  MarketingCampaignStatus,
  MarketingChannel,
  MarketingContact,
  MarketingContactSegment,
} from '../../../../types/marketing';
import {
  EMAIL_TEMPLATES,
  MARKETING_SEGMENTS,
  WHATSAPP_TEMPLATES,
  filterMarketingContacts,
} from '../database/logic';

export const CAMPAIGN_STATUSES: readonly MarketingCampaignStatus[] = [
  'Draft',
  'Aktif',
  'Selesai',
];

export const CAMPAIGN_OBJECTIVES: readonly string[] = [
  'Konversi Prospek Survei',
  'Penawaran Katalog & Promo',
  'Retensi & Pemeliharaan Klien',
  'Kolaborasi Mitra Arsitek / Korporat',
  'Undangan Konsultasi Workshop',
];

export interface CampaignFormDraft {
  id: string;
  title: string;
  objective: string;
  status: MarketingCampaignStatus;
  targetSegments: MarketingContactSegment[];
  enableWhatsApp: boolean;
  enableEmail: boolean;
  whatsappTemplateId: string;
  whatsappMessage: string;
  emailTemplateId: string;
  emailSubject: string;
  emailBody: string;
  replyToEmail: string;
  sentCount: number;
  lastSentAt: string | null;
  createdAt: string;
}

export function createEmptyCampaignDraft(defaultEmail = 'admin@shansusdzar.id'): CampaignFormDraft {
  const defaultWa = WHATSAPP_TEMPLATES[0];
  const defaultEm = EMAIL_TEMPLATES[0];
  return {
    id: `cmp-${Date.now().toString(36)}`,
    title: '',
    objective: CAMPAIGN_OBJECTIVES[0],
    status: 'Aktif',
    targetSegments: ['Prospek Baru', 'Klien Aktif'],
    enableWhatsApp: true,
    enableEmail: true,
    whatsappTemplateId: defaultWa?.id ?? 'custom',
    whatsappMessage:
      defaultWa?.isi ??
      'Halo Bapak/Ibu {nama}, kami dari Interior & Furniture Shansusdzar Indonesia.',
    emailTemplateId: defaultEm?.id ?? 'custom',
    emailSubject:
      defaultEm?.subjek ?? 'Informasi Katalog & Konsultasi Interior Shansusdzar Indonesia',
    emailBody:
      defaultEm?.isi ??
      'Yth. Bapak/Ibu {nama},\n\nBerikut informasi layanan interior custom kami untuk area {kota}.',
    replyToEmail: defaultEmail,
    sentCount: 0,
    lastSentAt: null,
    createdAt: new Date().toISOString(),
  };
}

export function toCampaignFormDraft(campaign: MarketingCampaign): CampaignFormDraft {
  return {
    id: campaign.id,
    title: campaign.judul,
    objective: campaign.tujuan,
    status: campaign.status,
    targetSegments: [...campaign.targetSegmen],
    enableWhatsApp: campaign.saluran.includes('whatsapp'),
    enableEmail: campaign.saluran.includes('email'),
    whatsappTemplateId: 'custom',
    whatsappMessage: campaign.pesanWhatsapp,
    emailTemplateId: 'custom',
    emailSubject: campaign.subjekEmail,
    emailBody: campaign.isiEmail,
    replyToEmail: campaign.emailBalasan,
    sentCount: campaign.jumlahTerkirim,
    lastSentAt: campaign.terakhirDikirim,
    createdAt: campaign.dibuatPada,
  };
}

export function validateCampaignDraft(draft: CampaignFormDraft): {
  valid: boolean;
  formError: string | null;
  fieldErrors: Partial<Record<string, string>>;
} {
  const fieldErrors: Partial<Record<string, string>> = {};
  if (!draft.title.trim()) {
    fieldErrors.title = 'Judul campaign wajib diisi.';
  }
  if (!draft.enableWhatsApp && !draft.enableEmail) {
    fieldErrors.enableWhatsApp = 'Aktifkan minimal satu saluran pengiriman (WhatsApp atau Email).';
  }
  if (draft.enableWhatsApp && !draft.whatsappMessage.trim()) {
    fieldErrors.whatsappMessage = 'Naskah pesan WhatsApp wajib diisi saat saluran WA aktif.';
  }
  if (draft.enableEmail) {
    if (!draft.emailSubject.trim()) {
      fieldErrors.emailSubject = 'Subjek email wajib diisi saat saluran Email aktif.';
    }
    if (!draft.emailBody.trim()) {
      fieldErrors.emailBody = 'Isi naskah email wajib diisi saat saluran Email aktif.';
    }
  }

  const valid = Object.keys(fieldErrors).length === 0;
  return {
    valid,
    formError: valid ? null : Object.values(fieldErrors)[0] ?? 'Periksa kembali data campaign.',
    fieldErrors,
  };
}

export function normalizeCampaignFromDraft(draft: CampaignFormDraft): MarketingCampaign {
  const channels: MarketingChannel[] = [];
  if (draft.enableWhatsApp) channels.push('whatsapp');
  if (draft.enableEmail) channels.push('email');

  const validSegments = draft.targetSegments.filter((seg) =>
    MARKETING_SEGMENTS.includes(seg)
  );

  return {
    id: draft.id.trim() || `cmp-${Date.now().toString(36)}`,
    judul: draft.title.trim(),
    tujuan: draft.objective.trim() || CAMPAIGN_OBJECTIVES[0],
    status: draft.status,
    targetSegmen: validSegments,
    saluran: channels,
    pesanWhatsapp: draft.whatsappMessage.trim(),
    subjekEmail: draft.emailSubject.trim(),
    isiEmail: draft.emailBody.trim(),
    emailBalasan: draft.replyToEmail.trim() || 'admin@shansusdzar.id',
    jumlahTerkirim: Math.max(0, Number(draft.sentCount) || 0),
    terakhirDikirim: draft.lastSentAt,
    dibuatPada: draft.createdAt || new Date().toISOString(),
    diperbaruiPada: new Date().toISOString(),
  };
}

export function resolveCampaignRecipients(
  campaign: MarketingCampaign,
  contacts: readonly MarketingContact[],
  channel: MarketingChannel,
  options: {
    search?: string;
    segmentOverride?: 'campaign' | 'all' | MarketingContactSegment;
    onlyNeverContacted?: boolean;
  } = {}
): MarketingContact[] {
  const channelCode = channel === 'whatsapp' ? 'wa' : 'email';
  const base = filterMarketingContacts(contacts, {
    search: options.search,
    channel: channelCode,
    segment:
      options.segmentOverride &&
      options.segmentOverride !== 'campaign' &&
      options.segmentOverride !== 'all'
        ? options.segmentOverride
        : 'all',
  });

  const segmentMode = options.segmentOverride ?? 'campaign';
  const segmented =
    segmentMode === 'campaign' && campaign.targetSegmen.length > 0
      ? base.filter((c) => campaign.targetSegmen.includes(c.segmen))
      : base;

  if (options.onlyNeverContacted) {
    return segmented.filter((c) => !c.terakhirDihubungi);
  }
  return segmented;
}
