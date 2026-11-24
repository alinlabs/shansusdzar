import { useState, type FormEvent } from 'react';
import { Save } from 'lucide-react';
import { AdminActionButton } from '../../../../components/admin/admin-action-buttons';
import { AdminFeedbackBanner, useAdminFeedbackState } from '../../../../components/admin/admin-feedback';
import { AdminFormSectionCard } from '../../../../components/admin/admin-form';
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

  useDocumentTitle(`Profil Usaha | Admin ${businessConfig.namaMerekSingkat}`);

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

  const handleSaveTentangPerusahaan = (event: FormEvent) => {
    event.preventDefault();
    if (!canSave) return;

    if (canEditBisnis) {
      const parsedPhone = parseIndonesianPhoneInput(bizDraft.whatsapp.nomorTampil);
      const normalizedDigits = parsedPhone.digits;
      const nextConfig = {
        ...bizDraft,
        drafPemilik: businessConfig.drafPemilik,
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
      const nextTentang = {
        ...tentangDraft,
        daftarParagraf: nextParagraphs,
        daftarMisi: nextMissions,
        labelTim: tentang.labelTim,
        judulTim: tentang.judulTim,
        anggotaTim: tentang.anggotaTim,
      };
      setTentangDraft(nextTentang);
      updateTentang(nextTentang);
    }

    recordActivity(
      'Memperbarui profil usaha & halaman Tentang',
      'Profil Usaha',
      canEditBisnis ? bizDraft.namaMerekSingkat : tentangDraft.judul
    );
    setFeedback({
      type: 'ok',
      text: 'Profil usaha berhasil disimpan.',
    });
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <AdminPageHeader
        title="Profil Usaha"
        actions={
          canSave ? (
            <AdminActionButton
              type="submit"
              form="admin-tentang-form"
              variant="primary"
              icon={<Save className="size-3.5" />}
              label="Simpan Perubahan"
              mobileLabel="Simpan"
            />
          ) : undefined
        }
      />

      <AdminFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      <form
        id="admin-tentang-form"
        onSubmit={handleSaveTentangPerusahaan}
        className="space-y-5 sm:space-y-6 max-w-6xl"
      >
        <AdminFormSectionCard title="Identitas & Kontak">
          {!canEditBisnis && (
            <div className="p-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] text-xs text-[var(--text-muted)]">
              Kolom ini hanya-baca (butuh izin `bisnis.edit`).
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField id="biz-brand" label="Nama Usaha">
              <Input
                id="biz-brand"
                disabled={!canEditBisnis}
                value={bizDraft.namaMerek}
                onChange={(e) => setBizDraft((p) => ({ ...p, namaMerek: e.target.value }))}
              />
            </FormField>
            <FormField id="biz-short" label="Nama Singkat">
              <Input
                id="biz-short"
                disabled={!canEditBisnis}
                value={bizDraft.namaMerekSingkat}
                onChange={(e) => setBizDraft((p) => ({ ...p, namaMerekSingkat: e.target.value }))}
              />
            </FormField>
            <FormField id="biz-wa" label="WhatsApp">
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
            <FormField id="biz-tagline" label="Tagline">
              <Input
                id="biz-tagline"
                disabled={!canEditBisnis}
                value={bizDraft.drafSlogan}
                onChange={(e) => setBizDraft((p) => ({ ...p, drafSlogan: e.target.value }))}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-[var(--border)]">
            <FormField id="biz-street" label="Jalan / Kampung">
              <Input
                id="biz-street"
                disabled={!canEditBisnis}
                value={bizDraft.alamat.jalan}
                onChange={(e) =>
                  setBizDraft((p) => ({
                    ...p,
                    alamat: { ...p.alamat, jalan: e.target.value },
                  }))
                }
              />
            </FormField>
            <FormField id="biz-rtrw" label="RT / RW">
              <Input
                id="biz-rtrw"
                disabled={!canEditBisnis}
                value={bizDraft.alamat.rtRw}
                onChange={(e) =>
                  setBizDraft((p) => ({
                    ...p,
                    alamat: { ...p.alamat, rtRw: e.target.value },
                  }))
                }
              />
            </FormField>
            <FormField id="biz-village" label="Desa / Kecamatan">
              <Input
                id="biz-village"
                disabled={!canEditBisnis}
                value={bizDraft.alamat.desa}
                onChange={(e) =>
                  setBizDraft((p) => ({
                    ...p,
                    alamat: { ...p.alamat, desa: e.target.value },
                  }))
                }
              />
            </FormField>
            <FormField id="biz-regency" label="Kabupaten / Kota">
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
            <FormField id="biz-postal" label="Kode Pos">
              <Input
                id="biz-postal"
                disabled={!canEditBisnis}
                value={bizDraft.alamat.kodePos}
                onChange={(e) =>
                  setBizDraft((p) => ({
                    ...p,
                    alamat: { ...p.alamat, kodePos: e.target.value },
                  }))
                }
              />
            </FormField>
            <FormField id="biz-country" label="Negara">
              <Input
                id="biz-country"
                disabled={!canEditBisnis}
                value={bizDraft.alamat.negara}
                onChange={(e) =>
                  setBizDraft((p) => ({
                    ...p,
                    alamat: { ...p.alamat, negara: e.target.value },
                  }))
                }
              />
            </FormField>
          </div>

          <FormField id="biz-addr" label="Alamat Lengkap">
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
            <FormField id="biz-fb" label="Facebook URL">
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
                      urlInstagram: p.mediaSosial?.urlInstagram ?? '',
                      urlTiktok: p.mediaSosial?.urlTiktok ?? '',
                    },
                  }))
                }
              />
            </FormField>

            <FormField id="biz-ig" label="Instagram URL">
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
                      urlInstagram: e.target.value,
                      urlTiktok: p.mediaSosial?.urlTiktok ?? '',
                    },
                  }))
                }
              />
            </FormField>

            <FormField id="biz-tt" label="TikTok URL">
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
                      urlInstagram: p.mediaSosial?.urlInstagram ?? '',
                      urlTiktok: e.target.value,
                    },
                  }))
                }
              />
            </FormField>
          </div>
        </AdminFormSectionCard>

        <AdminFormSectionCard title="Narasi Studio">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField id="t-eyebrow" label="Eyebrow">
              <Input
                id="t-eyebrow"
                disabled={!canEditTentang}
                value={tentangDraft.labelAtas}
                onChange={(e) => setTentangDraft((p) => ({ ...p, labelAtas: e.target.value }))}
              />
            </FormField>
            <FormField id="t-title" label="Judul">
              <Input
                id="t-title"
                disabled={!canEditTentang}
                value={tentangDraft.judul}
                onChange={(e) => setTentangDraft((p) => ({ ...p, judul: e.target.value }))}
              />
            </FormField>
          </div>
          <FormField id="t-lead" label="Ringkasan Pembuka">
            <Textarea
              id="t-lead"
              rows={2}
              disabled={!canEditTentang}
              value={tentangDraft.pengantar}
              onChange={(e) => setTentangDraft((p) => ({ ...p, pengantar: e.target.value }))}
            />
          </FormField>
          <FormField id="t-paragraphs" label="Paragraf Narasi (pisahkan dengan baris kosong)">
            <Textarea
              id="t-paragraphs"
              rows={5}
              disabled={!canEditTentang}
              value={paragraphsText}
              onChange={(e) => setParagraphsText(e.target.value)}
            />
          </FormField>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[var(--border)]">
            <FormField id="t-workshop-img" label="Foto Workshop (URL/Path)">
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
            <FormField id="t-workshop-alt" label="Alt Foto Workshop">
              <Input
                id="t-workshop-alt"
                disabled={!canEditTentang}
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

        <AdminFormSectionCard title="Visi & Misi">
          <FormField id="t-vis-statement" label="Pernyataan Visi">
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
          <FormField id="t-mis-title" label="Judul Misi">
            <Input
              id="t-mis-title"
              disabled={!canEditTentang}
              value={tentangDraft.judulMisi}
              onChange={(e) => setTentangDraft((p) => ({ ...p, judulMisi: e.target.value }))}
            />
          </FormField>
          <FormField id="t-mis-items" label="Poin Misi (1 per baris)">
            <Textarea
              id="t-mis-items"
              rows={4}
              disabled={!canEditTentang}
              value={missionItemsText}
              onChange={(e) => setMissionItemsText(e.target.value)}
            />
          </FormField>
        </AdminFormSectionCard>

        <AdminFormSectionCard title="Statistik Workshop">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tentangDraft.sorotanWorkshop.map((hl, idx) => (
              <div
                key={hl.id}
                className="p-3.5 sm:p-4 border border-[var(--border)] rounded-[var(--radius-md)] space-y-2.5"
              >
                <div className="grid grid-cols-2 gap-2.5">
                  <Input
                    disabled={!canEditTentang}
                    placeholder="Nilai"
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
                  placeholder="Keterangan"
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
