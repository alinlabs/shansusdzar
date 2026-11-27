import { formatDocumentPhoneDisplay } from './phone-format';
import { formatFullWilayahAddress } from './wilayah-indonesia';
import type { BusinessConfig } from '../types/business';
import type { CooperationAgreementDocument } from '../types/documents';
import type { ClientEntityType, WorkshopProject } from '../types/finance';

export const CLIENT_ENTITY_TYPE_OPTIONS: readonly {
  value: ClientEntityType;
  label: string;
}[] = [
  { value: 'pribadi', label: 'Pribadi' },
  { value: 'perusahaan', label: 'Perusahaan' },
  { value: 'instansi', label: 'Instansi' },
] as const;

export interface AgreementPartyMetadataRow {
  label: string;
  value: string;
  boldValue?: boolean;
}

export interface ResolvedAgreementPartyIdentities {
  firstPartyRows: AgreementPartyMetadataRow[];
  secondPartyType: ClientEntityType;
  secondPartyRows: AgreementPartyMetadataRow[];
  secondPartyLegalDescription: string;
  secondPartySignerName: string;
  secondPartySubRole: string;
}

const COMPANY_PREFIX_REGEX = /^(pt\.?|cv\.?|ud\.?|firma|perum|koperasi)\s+/i;
const INSTITUTION_PREFIX_REGEX =
  /^(dinas|kementerian|kementrian|pemkab|pemkot|pemprov|pemerintah|badan|lembaga|balai|instansi|kecamatan|kelurahan|desa|sekolah|sdn|smpn|sman|smkn|madrasah|universitas|institut|politeknik|akademi|rsud|puskesmas|yayasan|sekretariat|kantor|polres|polsek|kodim|pengadilan|kejaksaan)\b/i;

export function normalizeClientEntityType(
  rawType?: unknown,
  fallbackName?: string
): ClientEntityType {
  if (rawType === 'pribadi' || rawType === 'perusahaan' || rawType === 'instansi') {
    return rawType;
  }
  const trimmedName = (fallbackName ?? '').trim();
  if (trimmedName) {
    if (COMPANY_PREFIX_REGEX.test(trimmedName) || /\b(tbk|persero)\b/i.test(trimmedName)) {
      return 'perusahaan';
    }
    if (INSTITUTION_PREFIX_REGEX.test(trimmedName)) {
      return 'instansi';
    }
  }
  return 'pribadi';
}

export function getClientNameFieldLabel(entityType?: unknown): string {
  const normalized = normalizeClientEntityType(entityType);
  if (normalized === 'perusahaan') return 'Nama Perusahaan';
  if (normalized === 'instansi') return 'Nama Instansi';
  return 'Nama Lengkap';
}

export function resolveAgreementPartyIdentities(
  spks: CooperationAgreementDocument,
  businessConfig: BusinessConfig,
  linkedProject?: WorkshopProject | null
): ResolvedAgreementPartyIdentities {
  const firstPartyPhoneRaw =
    spks.teleponPihakPertama?.trim() || businessConfig.whatsapp.nomorTampil || '';

  const firstPartyRows: AgreementPartyMetadataRow[] = [
    {
      label: 'Nama Perusahaan',
      value: spks.perusahaanPihakPertama?.trim() || businessConfig.namaMerek,
      boldValue: true,
    },
    {
      label: 'Penanggung Jawab',
      value: spks.perwakilanPihakPertama?.trim() || businessConfig.drafPemilik.namaPemilik,
    },
    {
      label: 'Jabatan',
      value: spks.jabatanPihakPertama?.trim() || businessConfig.drafPemilik.jabatanPemilik,
    },
    {
      label: 'Telepon / WhatsApp',
      value: formatDocumentPhoneDisplay(firstPartyPhoneRaw) || '-',
    },
    {
      label: 'Alamat Domisili',
      value: spks.alamatPihakPertama?.trim() || businessConfig.alamat.alamatLengkap || '-',
    },
  ];

  const candidateEntityName =
    spks.namaPerusahaanPihakKedua?.trim() ||
    spks.namaPihakKedua?.trim() ||
    linkedProject?.namaKlien?.trim() ||
    '';

  const secondPartyType = normalizeClientEntityType(
    spks.jenisPihakKedua ?? linkedProject?.jenisKlien,
    candidateEntityName
  );

  const secondPartyPhoneRaw =
    spks.teleponPihakKedua?.trim() || linkedProject?.teleponKlien?.trim() || '';
  const secondPartyPhoneDisplay = formatDocumentPhoneDisplay(secondPartyPhoneRaw) || '-';
  const secondPartyAddressDisplay =
    spks.alamatPihakKedua?.trim() || formatFullWilayahAddress(linkedProject?.alamat) || '-';

  if (secondPartyType === 'pribadi') {
    const fullName =
      spks.namaPihakKedua?.trim() || linkedProject?.namaKlien?.trim() || '-';
    return {
      firstPartyRows,
      secondPartyType,
      secondPartyRows: [
        { label: 'Nama Lengkap', value: fullName, boldValue: true },
        { label: 'Telepon / WhatsApp', value: secondPartyPhoneDisplay },
        { label: 'Alamat Domisili', value: secondPartyAddressDisplay },
      ],
      secondPartyLegalDescription:
        'Dalam perjanjian ini bertindak selaku pemilik/pemberi tugas, selanjutnya disebut sebagai PIHAK KEDUA (PEMBERI TUGAS).',
      secondPartySignerName: fullName,
      secondPartySubRole: spks.jabatanPihakKedua?.trim() || 'Pemberi Tugas / Klien',
    };
  }

  const orgLabel = secondPartyType === 'instansi' ? 'Nama Instansi' : 'Nama Perusahaan';
  const orgName =
    spks.namaPerusahaanPihakKedua?.trim() ||
    spks.namaPihakKedua?.trim() ||
    linkedProject?.namaKlien?.trim() ||
    '-';

  const fallbackIndividualFromName =
    spks.namaPihakKedua?.trim() && spks.namaPihakKedua.trim() !== orgName
      ? spks.namaPihakKedua.trim()
      : '';

  const picName =
    spks.penanggungJawabPihakKedua?.trim() ||
    linkedProject?.penanggungJawabKlien?.trim() ||
    fallbackIndividualFromName ||
    '-';

  const rawJabatan =
    spks.jabatanPihakKedua?.trim() || linkedProject?.jabatanKlien?.trim() || '';
  const picRole =
    rawJabatan && !/^(pemberi tugas \/ klien|pemilik \/ pemberi tugas)$/i.test(rawJabatan)
      ? rawJabatan
      : 'Penanggung Jawab';

  return {
    firstPartyRows,
    secondPartyType,
    secondPartyRows: [
      { label: orgLabel, value: orgName, boldValue: true },
      { label: 'Penanggung Jawab', value: picName },
      { label: 'Jabatan', value: picRole },
      { label: 'Telepon / WhatsApp', value: secondPartyPhoneDisplay },
      { label: 'Alamat Domisili', value: secondPartyAddressDisplay },
    ],
    secondPartyLegalDescription:
      'Dalam perjanjian ini bertindak untuk dan atas nama pemberi tugas, selanjutnya disebut sebagai PIHAK KEDUA (PEMBERI TUGAS).',
    secondPartySignerName: picName !== '-' ? picName : orgName,
    secondPartySubRole: orgName !== '-' ? `${picRole} · ${orgName}` : picRole,
  };
}
