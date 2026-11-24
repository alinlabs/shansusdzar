import { useState, type FormEvent } from 'react';
import { Save } from 'lucide-react';
import { AdminFeedbackBanner, useAdminFeedbackState } from '../../../../components/admin/admin-feedback';
import { AdminFormSectionCard } from '../../../../components/admin/admin-form';
import { Button } from '../../../../components/ui/button';
import { FormField, Input, PhoneInput, Textarea } from '../../../../components/ui/form-controls';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import { parseIndonesianPhoneInput } from '../../../../lib/phone-format';
import { hasPermission } from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import { AdminPageHeader } from '../../admin-shell';

export default function AdminTentangPage() {
  const businessConfig = useSiteContentStore((state) => state.businessConfig);
  const updateBusinessConfig = useSiteContentStore((state) => state.updateBusinessConfig);
  const tentang = useSiteContentStore((state) => state.tentang);
  const updateTentang = useSiteContentStore((state) => state.updateTentang);

  const users = useAdminAuthStore((state) => state.users);
  const roles = useAdminAuthStore((state) => state.roles);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  useDocumentTitle(`Tentang Perusahaan | Tentang & Situs Admin ${businessConfig.namaMerekSingkat}`);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const currentRole = currentUser ? roles.find((r) => r.id === currentUser.idPeran) ?? null : null;
  const canEditTentang = hasPermission(currentRole, 'tentang.edit');
  const canEditBisnis = hasPermission(currentRole, 'bisnis.edit');
  const canSave = canEditTentang || canEditBisnis;

  const [feedback, setFeedback] = useAdminFeedbackState();
  const [bizDraft, setBizDraft] = useState(() => structuredClone(businessConfig));
  const [tentangDraft, setTentangDraft] = useState(() => structuredClone(tentang));
  const [paragraphsText, setParagraphsText] = useState(() => tentang.daftarParagraf.join('\n\n'));
  const [missionItemsText, setMissionItemsText] = useState(() => tentang.daftarMisi.join('\n'));
  const [commitmentsText, setCommitmentsText] = useState(() =>
    tentang.komitmenLayanan.join('\n')
  );

  const handleSaveTentangPerusahaan = (event: FormEvent) => {
    event.preventDefault();
    if (!canSave) return;

    if (canEditBisnis) {
      const parsedPhone = parseIndonesianPhoneInput(bizDraft.whatsapp.nomorTampil);
      const normalizedDigits = parsedPhone.digits;
      const nextConfig = {
        ...bizDraft,
        drafPemilik: businessConfig.drafPemilik,
        pengaturanHarga: businessConfig.pengaturanHarga,
        whatsapp: {
          ...bizDraft.whatsapp,
          digitTerstandar: normalizedDigits,
          urlDasar: `https://wa.me/${normalizedDigits}`,
        },
      };
      setBizDraft(nextConfig);
      updateBusinessConfig(nextConfig);
    }

    if (canEditTentang) {
      const nextParagraphs = paragraphsText
        .split(/\n{2,}/)
        .map((s) => s.trim())
        .filter(Boolean);
      const nextMissions = missionItemsText
        .split(/\n+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const nextCommitments = commitmentsText
        .split(/\n+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const nextTentang = {
        ...tentangDraft,
        daftarParagraf: nextParagraphs,
        daftarMisi: nextMissions,
        komitmenLayanan: nextCommitments,
        biografiPemilik: tentang.biografiPemilik,
        labelTim: tentang.labelTim,
        judulTim: tentang.judulTim,
        deskripsiTim: tentang.deskripsiTim,
        anggotaTim: tentang.anggotaTim,
      };
      setTentangDraft(nextTentang);
      updateTentang(nextTentang);
    }

    recordActivity(
      'Memperbarui profil & identitas Tentang Perusahaan',
      'Tentang Perusahaan',
      canEditBisnis ? bizDraft.namaMerekSingkat : tentangDraft.judul
    );
    setFeedback({
      type: 'ok',
      text: 'Identitas perusahaan, alamat workshop, kontak resmi, narasi studio, dan visi misi berhasil disimpan.',
    });
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Tentang Perusahaan"
        description="Kelola identitas usaha resmi, kontak WhatsApp, sosial media, narasi studio, foto workshop, visi misi, dan statistik workshop."
        actions={
          canSave ? (
            <Button type="submit" form="admin-tentang-form" variant="primary" size="sm">
              <Save className="size-3.5" aria-hidden="true" />
              Simpan Perubahan
            </Button>
          ) : undefined
        }
      />

      <AdminFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      <form
        id="admin-tentang-form"
        onSubmit={handleSaveTentangPerusahaan}
        className="space-y-6 max-w-5xl"
      >
        <AdminFormSectionCard
          title="Identitas Usaha, Alamat, Kontak WhatsApp & Sosial Media"
          description="Informasi resmi perusahaan yang tampil di header, footer, halaman kontak, dan tautan WhatsApp publik."
        >
          {!canEditBisnis && (
            <div className="p-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] text-xs text-[var(--text-muted)]">
              Anda tidak memiliki izin ubah identitas bisnis (`bisnis.edit`). Kolom identitas usaha
              bersifat baca-saja.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField id="biz-brand" label="Nama Lengkap Usaha / Perusahaan">
              <Input
                id="biz-brand"
                disabled={!canEditBisnis}
                value={bizDraft.namaMerek}
                onChange={(e) => setBizDraft((p) => ({ ...p, namaMerek: e.target.value }))}
              />
            </FormField>
            <FormField id="biz-short" label="Nama Singkat (Header & Situs)">
              <Input
                id="biz-short"
                disabled={!canEditBisnis}
                value={bizDraft.namaMerekSingkat}
                onChange={(e) => setBizDraft((p) => ({ ...p, namaMerekSingkat: e.target.value }))}
              />
            </FormField>
            <FormField id="biz-wa" label="Nomor WhatsApp Resmi">
              <PhoneInput
                id="biz-wa"
                disabled={!canEditBisnis}
                valueFormat="display"
                value={bizDraft.whatsapp.nomorTampil}
                onValueChange={(nextDisplay) =>
                  setBizDraft((p) => ({
                    ...p,
                    whatsapp: { ...p.whatsapp, nomorTampil: nextDisplay },
                  }))
                }
              />
            </FormField>
            <FormField id="biz-regency" label="Kabupaten / Kota Workshop">
              <Input
                id="biz-regency"
                disabled={!canEditBisnis}
                value={bizDraft.alamat.kabupaten}
                onChange={(e) =>
                  setBizDraft((p) => ({
                    ...p,
                    alamat: { ...p.alamat, kabupaten: e.target.value },
                  }))
                }
              />
            </FormField>
          </div>

          <FormField id="biz-tagline" label="Tagline Studio">
            <Textarea
              id="biz-tagline"
              rows={2}
              disabled={!canEditBisnis}
              value={bizDraft.drafSlogan}
              onChange={(e) => setBizDraft((p) => ({ ...p, drafSlogan: e.target.value }))}
            />
          </FormField>

          <FormField id="biz-addr" label="Alamat Lengkap Workshop (Footer & Google Maps)">
            <Textarea
              id="biz-addr"
              rows={2}
              disabled={!canEditBisnis}
              value={bizDraft.alamat.alamatLengkap}
              onChange={(e) =>
                setBizDraft((p) => ({
                  ...p,
                  alamat: { ...p.alamat, alamatLengkap: e.target.value },
                }))
              }
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-[var(--border)]">
            <FormField id="biz-fb" label="Tautan Facebook Resmi">
              <Input
                id="biz-fb"
                type="url"
                disabled={!canEditBisnis}
                value={bizDraft.mediaSosial?.urlFacebook ?? ''}
                placeholder="https://www.facebook.com/..."
                onChange={(e) =>
                  setBizDraft((p) => ({
                    ...p,
                    mediaSosial: {
                      urlFacebook: e.target.value,
                      akunFacebook: p.mediaSosial?.akunFacebook ?? 'Shansusdzar Indonesia',
                      urlInstagram: p.mediaSosial?.urlInstagram ?? '',
                      akunInstagram: p.mediaSosial?.akunInstagram ?? '@shansusdzar.indonesia',
                      urlTiktok: p.mediaSosial?.urlTiktok ?? '',
                      akunTiktok: p.mediaSosial?.akunTiktok ?? '@shansusdzar.indonesia',
                    },
                  }))
                }
              />
            </FormField>

            <FormField id="biz-ig" label="Tautan Instagram Resmi">
              <Input
                id="biz-ig"
                type="url"
                disabled={!canEditBisnis}
                value={bizDraft.mediaSosial?.urlInstagram ?? ''}
                placeholder="https://www.instagram.com/..."
                onChange={(e) =>
                  setBizDraft((p) => ({
                    ...p,
                    mediaSosial: {
                      urlFacebook: p.mediaSosial?.urlFacebook ?? '',
                      akunFacebook: p.mediaSosial?.akunFacebook ?? 'Shansusdzar Indonesia',
                      urlInstagram: e.target.value,
                      akunInstagram: p.mediaSosial?.akunInstagram ?? '@shansusdzar.indonesia',
                      urlTiktok: p.mediaSosial?.urlTiktok ?? '',
                      akunTiktok: p.mediaSosial?.akunTiktok ?? '@shansusdzar.indonesia',
                    },
                  }))
                }
              />
            </FormField>

            <FormField id="biz-tt" label="Tautan TikTok Resmi">
              <Input
                id="biz-tt"
                type="url"
                disabled={!canEditBisnis}
                value={bizDraft.mediaSosial?.urlTiktok ?? ''}
                placeholder="https://www.tiktok.com/@..."
                onChange={(e) =>
                  setBizDraft((p) => ({
                    ...p,
                    mediaSosial: {
                      urlFacebook: p.mediaSosial?.urlFacebook ?? '',
                      akunFacebook: p.mediaSosial?.akunFacebook ?? 'Shansusdzar Indonesia',
                      urlInstagram: p.mediaSosial?.urlInstagram ?? '',
                      akunInstagram: p.mediaSosial?.akunInstagram ?? '@shansusdzar.indonesia',
                      urlTiktok: e.target.value,
                      akunTiktok: p.mediaSosial?.akunTiktok ?? '@shansusdzar.indonesia',
                    },
                  }))
                }
              />
            </FormField>
          </div>
        </AdminFormSectionCard>

        <AdminFormSectionCard title="Pengantar & Narasi Studio">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField id="t-eyebrow" label="Eyebrow">
              <Input
                id="t-eyebrow"
                disabled={!canEditTentang}
                value={tentangDraft.labelAtas}
                onChange={(e) => setTentangDraft((p) => ({ ...p, labelAtas: e.target.value }))}
              />
            </FormField>
            <FormField id="t-title" label="Judul Halaman">
              <Input
                id="t-title"
                disabled={!canEditTentang}
                value={tentangDraft.judul}
                onChange={(e) => setTentangDraft((p) => ({ ...p, judul: e.target.value }))}
              />
            </FormField>
          </div>
          <FormField id="t-lead" label="Ringkasan Pembuka (Lead)">
            <Textarea
              id="t-lead"
              rows={2}
              disabled={!canEditTentang}
              value={tentangDraft.pengantar}
              onChange={(e) => setTentangDraft((p) => ({ ...p, pengantar: e.target.value }))}
            />
          </FormField>
          <FormField
            id="t-paragraphs"
            label="Paragraf Narasi (pisahkan antar paragraf dengan baris kosong)"
          >
            <Textarea
              id="t-paragraphs"
              rows={5}
              disabled={!canEditTentang}
              value={paragraphsText}
              onChange={(e) => setParagraphsText(e.target.value)}
            />
          </FormField>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[var(--border)]">
            <FormField
              id="t-workshop-img"
              label="Path / URL Foto Workshop (Pembuka Halaman)"
              hint="Default: /images/atelier-studio-craft.webp"
            >
              <Input
                id="t-workshop-img"
                disabled={!canEditTentang}
                placeholder="/images/atelier-studio-craft.webp"
                value={tentangDraft.gambarWorkshop ?? '/images/atelier-studio-craft.webp'}
                onChange={(e) =>
                  setTentangDraft((p) => ({ ...p, gambarWorkshop: e.target.value }))
                }
              />
            </FormField>
            <FormField id="t-workshop-alt" label="Keterangan Foto Workshop (Alt Text)">
              <Input
                id="t-workshop-alt"
                disabled={!canEditTentang}
                placeholder="Suasana pengerjaan workshop Shansusdzar Indonesia"
                value={tentangDraft.teksAltWorkshop ?? ''}
                onChange={(e) =>
                  setTentangDraft((p) => ({ ...p, teksAltWorkshop: e.target.value }))
                }
              />
            </FormField>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField id="t-loc-eyebrow" label="Eyebrow Lokasi">
              <Input
                id="t-loc-eyebrow"
                disabled={!canEditTentang}
                value={tentangDraft.labelLokasi}
                onChange={(e) =>
                  setTentangDraft((p) => ({ ...p, labelLokasi: e.target.value }))
                }
              />
            </FormField>
            <FormField id="t-loc-title" label="Judul Lokasi">
              <Input
                id="t-loc-title"
                disabled={!canEditTentang}
                value={tentangDraft.judulLokasi}
                onChange={(e) =>
                  setTentangDraft((p) => ({ ...p, judulLokasi: e.target.value }))
                }
              />
            </FormField>
          </div>
        </AdminFormSectionCard>

        <AdminFormSectionCard title="Prinsip Kerja Perusahaan">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tentangDraft.prinsipKerja.map((wp, idx) => (
              <div
                key={wp.id}
                className="p-4 border border-[var(--border)] rounded-[var(--radius-md)] space-y-2.5"
              >
                <p className="text-xs font-medium text-[var(--text-muted)] tabular-nums">
                  Prinsip {wp.nomor}
                </p>
                <Input
                  disabled={!canEditTentang}
                  value={wp.judul}
                  onChange={(e) =>
                    setTentangDraft((p) => ({
                      ...p,
                      prinsipKerja: p.prinsipKerja.map((item, i) =>
                        i === idx ? { ...item, judul: e.target.value } : item
                      ),
                    }))
                  }
                />
                <Textarea
                  rows={2}
                  disabled={!canEditTentang}
                  value={wp.deskripsi}
                  onChange={(e) =>
                    setTentangDraft((p) => ({
                      ...p,
                      prinsipKerja: p.prinsipKerja.map((item, i) =>
                        i === idx ? { ...item, deskripsi: e.target.value } : item
                      ),
                    }))
                  }
                />
              </div>
            ))}
          </div>
        </AdminFormSectionCard>

        <AdminFormSectionCard title="Visi, Misi & Komitmen Layanan">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField id="t-vis-eyebrow" label="Eyebrow Visi & Misi">
              <Input
                id="t-vis-eyebrow"
                disabled={!canEditTentang}
                value={tentangDraft.labelVisi}
                onChange={(e) =>
                  setTentangDraft((p) => ({ ...p, labelVisi: e.target.value }))
                }
              />
            </FormField>
            <FormField id="t-vis-title" label="Judul Seksi Visi & Misi">
              <Input
                id="t-vis-title"
                disabled={!canEditTentang}
                value={tentangDraft.judulVisi}
                onChange={(e) => setTentangDraft((p) => ({ ...p, judulVisi: e.target.value }))}
              />
            </FormField>
          </div>
          <FormField id="t-vis-statement" label="Pernyataan Visi Studio">
            <Textarea
              id="t-vis-statement"
              rows={2}
              disabled={!canEditTentang}
              value={tentangDraft.pernyataanVisi}
              onChange={(e) =>
                setTentangDraft((p) => ({ ...p, pernyataanVisi: e.target.value }))
              }
            />
          </FormField>
          <FormField id="t-mis-title" label="Judul Daftar Misi">
            <Input
              id="t-mis-title"
              disabled={!canEditTentang}
              value={tentangDraft.judulMisi}
              onChange={(e) => setTentangDraft((p) => ({ ...p, judulMisi: e.target.value }))}
            />
          </FormField>
          <FormField id="t-mis-items" label="Poin Misi (satu poin per baris)">
            <Textarea
              id="t-mis-items"
              rows={4}
              disabled={!canEditTentang}
              value={missionItemsText}
              onChange={(e) => setMissionItemsText(e.target.value)}
            />
          </FormField>
          <FormField id="t-commitments" label="Poin Komitmen Pelayanan (satu poin per baris)">
            <Textarea
              id="t-commitments"
              rows={3}
              disabled={!canEditTentang}
              value={commitmentsText}
              onChange={(e) => setCommitmentsText(e.target.value)}
            />
          </FormField>
        </AdminFormSectionCard>

        <AdminFormSectionCard title="Sorotan Statistik Workshop">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tentangDraft.sorotanWorkshop.map((hl, idx) => (
              <div
                key={hl.id}
                className="p-4 border border-[var(--border)] rounded-[var(--radius-md)] space-y-2.5"
              >
                <div className="grid grid-cols-2 gap-2.5">
                  <Input
                    disabled={!canEditTentang}
                    placeholder="Nilai (mis. 450 m²)"
                    value={hl.nilai}
                    onChange={(e) =>
                      setTentangDraft((p) => ({
                        ...p,
                        sorotanWorkshop: p.sorotanWorkshop.map((item, i) =>
                          i === idx ? { ...item, nilai: e.target.value } : item
                        ),
                      }))
                    }
                  />
                  <Input
                    disabled={!canEditTentang}
                    placeholder="Label"
                    value={hl.label}
                    onChange={(e) =>
                      setTentangDraft((p) => ({
                        ...p,
                        sorotanWorkshop: p.sorotanWorkshop.map((item, i) =>
                          i === idx ? { ...item, label: e.target.value } : item
                        ),
                      }))
                    }
                  />
                </div>
                <Input
                  disabled={!canEditTentang}
                  placeholder="Keterangan singkat"
                  value={hl.detail}
                  onChange={(e) =>
                    setTentangDraft((p) => ({
                      ...p,
                      sorotanWorkshop: p.sorotanWorkshop.map((item, i) =>
                        i === idx ? { ...item, detail: e.target.value } : item
                      ),
                    }))
                  }
                />
              </div>
            ))}
          </div>
        </AdminFormSectionCard>
      </form>
    </div>
  );
}
