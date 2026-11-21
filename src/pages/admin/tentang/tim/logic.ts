import type { TeamMemberData } from '../../../../types/cms';

export interface TeamMemberValidationResult {
  valid: boolean;
  formError: string | null;
  fieldErrors: Partial<Record<string, string>>;
}

export function deriveMemberInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return 'TM';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`.toUpperCase();
}

export function createEmptyTeamMember(): TeamMemberData {
  return {
    id: `tim-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    nama: '',
    inisial: '',
    jabatan: '',
    divisi: 'Workshop & Produksi',
    biodata: '',
    fotoProfil: '',
    teksAltFoto: '',
  };
}

export function validateTeamMemberDraft(member: TeamMemberData): TeamMemberValidationResult {
  const fieldErrors: Partial<Record<string, string>> = {};
  if (!member.nama.trim()) {
    fieldErrors.nama = 'Nama anggota tim wajib diisi.';
  }
  if (!member.jabatan.trim()) {
    fieldErrors.jabatan = 'Jabatan atau peran wajib diisi.';
  }
  if (!member.divisi.trim()) {
    fieldErrors.divisi = 'Divisi wajib diisi.';
  }
  if (!member.biodata.trim()) {
    fieldErrors.biodata = 'Deskripsi keahlian/tugas wajib diisi.';
  }

  const keys = Object.keys(fieldErrors);
  if (keys.length > 0) {
    return {
      valid: false,
      formError: fieldErrors[keys[0]] ?? 'Lengkapi kolom anggota tim yang wajib diisi.',
      fieldErrors,
    };
  }
  return { valid: true, formError: null, fieldErrors: {} };
}

export function normalizeTeamMemberPayload(member: TeamMemberData): TeamMemberData {
  const cleanName = member.nama.trim();
  const cleanInitials = member.inisial.trim().toUpperCase().slice(0, 3);
  const cleanAvatar = member.fotoProfil?.trim() || '';
  return {
    id: member.id,
    nama: cleanName,
    inisial: cleanInitials || deriveMemberInitials(cleanName),
    jabatan: member.jabatan.trim(),
    divisi: member.divisi.trim(),
    biodata: member.biodata.trim(),
    fotoProfil: cleanAvatar,
    teksAltFoto: member.teksAltFoto?.trim() || (cleanAvatar ? `Foto ${cleanName}` : ''),
  };
}

export async function readResizedPortraitDataUrl(file: File, maxDimension = 640): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Gagal membaca berkas gambar.'));
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) {
        reject(new Error('Berkas gambar kosong.'));
        return;
      }

      const img = new Image();
      img.onerror = () => resolve(result);
      img.onload = () => {
        const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(result);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/webp', 0.86));
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
  });
}
