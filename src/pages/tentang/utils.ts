import { BUSINESS_CONFIG, buildMapsSearchUrl, buildWhatsAppUrl } from '../../lib/business-config';
import type { OwnerDraftContent } from '../../types/business';

export const TENTANG_STATIC_HEADINGS = {
  introEyebrow: 'Tentang Kami',
  visionTitle: 'Visi Studio',
  missionTitle: 'Misi Pengerjaan & Pelayanan',
  teamEyebrow: 'Tim & Workshop',
  teamTitle: 'Orang-Orang di Balik Setiap Pengerjaan',
  locationEyebrow: 'Lokasi & Kontak',
  locationTitle: 'Berbasis di Purwakarta, Jawa Barat',
} as const;

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
      portraitPath: string;
      portraitAlt: string;
    };

export function resolveOwnerPublicProfile(
  ownerDraft: OwnerDraftContent = BUSINESS_CONFIG.drafPemilik
): OwnerPublicProfile {
  if (!ownerDraft.terverifikasi) {
    return {
      status: 'unverified',
      portraitAlt: ownerDraft.teksAltFoto,
      noticeTitle: 'Profil & Pernyataan Pemilik Menunggu Konfirmasi',
      noticeDescription:
        'Identitas, foto resmi, dan kutipan pimpinan usaha sengaja belum ditampilkan ke publik hingga data final disetujui langsung oleh pemilik usaha.',
    };
  }

  return {
    status: 'verified',
    name: ownerDraft.namaPemilik,
    role: ownerDraft.jabatanPemilik,
    quote: ownerDraft.kutipanPemilik,
    portraitPath: ownerDraft.jalurFoto,
    portraitAlt: ownerDraft.teksAltFoto,
  };
}

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
