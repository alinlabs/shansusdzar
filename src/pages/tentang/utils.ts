import tentangContentData from '../../data/konten-tentang.json';
import { BUSINESS_CONFIG, buildMapsSearchUrl, buildWhatsAppUrl } from '../../lib/business-config';
import type { OwnerDraftContent } from '../../types/business';

export interface WorkingPrincipleItem {
  id: string;
  nomor: string;
  judul: string;
  deskripsi: string;
}

export type OwnerPublicProfile =
  | {
      status: 'unverified';
      portraitAlt: string;
      noticeTitle: string;
      noticeDescription: string;
    }
  | {
      status: 'verified';
      name: string;
      role: string;
      quote: string;
      biography: string;
      portraitPath: string;
      portraitAlt: string;
    };

export const STUDIO_CRAFT_IMAGE = tentangContentData.gambarKriyaStudio;

export const STUDIO_INTRO_DRAFT = tentangContentData.drafPengantarStudio;

export const OWNER_BIOGRAPHY_DRAFT = '';

export function resolveOwnerPublicProfile(
  ownerDraft: OwnerDraftContent = BUSINESS_CONFIG.drafPemilik,
  biographyDraft: string = OWNER_BIOGRAPHY_DRAFT
): OwnerPublicProfile {
  if (!ownerDraft.terverifikasi) {
    return {
      status: 'unverified',
      portraitAlt: ownerDraft.teksAltFoto,
      noticeTitle: 'Profil & Pernyataan Pemilik Menunggu Konfirmasi',
      noticeDescription:
        'Identitas, foto resmi, biografi, dan kutipan pimpinan usaha sengaja belum ditampilkan ke publik hingga data final disetujui langsung oleh pemilik usaha.',
    };
  }

  return {
    status: 'verified',
    name: ownerDraft.namaPemilik,
    role: ownerDraft.jabatanPemilik,
    quote: ownerDraft.kutipanPemilik,
    biography: biographyDraft,
    portraitPath: ownerDraft.jalurFoto,
    portraitAlt: ownerDraft.teksAltFoto,
  };
}

export const WORKING_PRINCIPLES_DRAFT: WorkingPrincipleItem[] =
  tentangContentData.prinsipKerjaPublik as WorkingPrincipleItem[];

export function getLocationContactActions() {
  return {
    addressText: BUSINESS_CONFIG.alamat.alamatLengkap,
    whatsappDisplay: BUSINESS_CONFIG.whatsapp.nomorTampil,
    whatsappUrl: buildWhatsAppUrl(
      `Halo ${BUSINESS_CONFIG.namaMerek}, saya ingin menanyakan jadwal kunjungan atau konsultasi di Purwakarta.`
    ),
    mapsSearchUrl: buildMapsSearchUrl(),
  };
}
