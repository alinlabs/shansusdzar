import { useState, type ChangeEvent, type FormEvent } from 'react';
import {
  ImagePlus,
  Pencil,
  Plus,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react';
import { AdminActionButton } from '../../../components/admin/admin-action-buttons';
import { AdminFeedbackBanner, useAdminFeedbackState } from '../../../components/admin/admin-feedback';
import { AdminFormSectionCard } from '../../../components/admin/admin-form';
import {
  AdminMobileTabBar,
  AdminMobileViewModeToggle,
  useMobileFormViewMode,
  type MobileFormTabItem,
} from '../../../components/admin/mobile-form-tabs';
import { Button } from '../../../components/ui/button';
import {
  Checkbox,
  FormField,
  FormFieldStyleProvider,
  Input,
  PhoneInput,
  Textarea,
} from '../../../components/ui/form-controls';
import { ImageFallback } from '../../../components/ui/image-fallback';
import { useDocumentTitle } from '../../../hooks/use-document-title';
import { useIsMobileViewport } from '../../../hooks/use-mobile-viewport';
import { useCachedMediaSrc } from '../../../lib/media-cache';
import { canEditPage } from '../../../lib/rbac';
import { useAdminAuthStore } from '../../../store/admin-auth-store';
import { useSiteContentStore } from '../../../store/site-content-store';
import type { TeamMemberData } from '../../../types/cms';
import { AdminMobileBottomAction, AdminPageHeader, useAdminScrollControl } from '../admin-shell';
import {
  buildNormalizedBusinessConfig,
  buildNormalizedOperationalInfo,
  buildNormalizedTentangContent,
  readResizedPortraitDataUrl,
  upsertTeamMemberList,
} from './logic';
import { TeamMemberModal } from './team-member-modal';

const PROFIL_USAHA_MOBILE_TABS: readonly MobileFormTabItem[] = [
  { id: 'identitas', label: 'Identitas' },
  { id: 'profil', label: 'Profil' },
  { id: 'pemilik-tim', label: 'Pemilik & Tim' },
  { id: 'beranda', label: 'Beranda' },
  { id: 'keunggulan', label: 'Keunggulan' },
  { id: 'alur-kerja', label: 'Alur Kerja' },
  { id: 'layanan', label: 'Layanan' },
] as const;

function TeamMemberAvatarPreview({ member }: { member: TeamMemberData }) {
  const cached = useCachedMediaSrc(member.fotoProfil || null);
  const src = cached ?? (member.fotoProfil?.trim() || null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const hasPhoto = Boolean(src) && failedSrc !== src;

  if (hasPhoto && src) {
    return (
      <div className="size-12 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] overflow-hidden shrink-0">
        <img
          src={src}
          alt={member.teksAltFoto || `Foto ${member.nama}`}
          onError={() => setFailedSrc(src)}
          className="size-full object-cover object-top"
        />
      </div>
    );
  }

  return (
    <div className="size-12 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] flex items-center justify-center text-sm font-semibold text-[var(--text)] shrink-0">
      {member.inisial}
    </div>
  );
}

export default function AdminProfilUsahaPage() {
  const businessConfig = useSiteContentStore((state) => state.businessConfig);
  const updateBusinessConfig = useSiteContentStore((state) => state.updateBusinessConfig);
  const tentang = useSiteContentStore((state) => state.tentang);
  const updateTentang = useSiteContentStore((state) => state.updateTentang);
  const beranda = useSiteContentStore((state) => state.beranda);
  const updateBeranda = useSiteContentStore((state) => state.updateBeranda);
  const operationalInfo = useSiteContentStore((state) => state.operationalInfo);
  const updateOperationalInfo = useSiteContentStore((state) => state.updateOperationalInfo);

  const users = useAdminAuthStore((state) => state.users);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  useDocumentTitle(`Profil Usaha | Admin ${businessConfig.namaMerek}`);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const canEditProfilUsaha = canEditPage(currentUser, 'profil-usaha');
  const canEditBisnis = canEditProfilUsaha;
  const canEditTentang = canEditProfilUsaha;
  const canEditOperasional = canEditProfilUsaha;
  const canSave = canEditProfilUsaha;

  const [feedback, setFeedback] = useAdminFeedbackState();

  const [bizDraft, setBizDraft] = useState(() => structuredClone(businessConfig));
  const [tentangDraft, setTentangDraft] = useState(() => structuredClone(tentang));
  const [paragraphsText, setParagraphsText] = useState(() => tentang.daftarParagraf.join('\n\n'));
  const [missionItemsText, setMissionItemsText] = useState(() => tentang.daftarMisi.join('\n'));
  const [berandaDraft, setBerandaDraft] = useState(() => structuredClone(beranda));
  const [opDraft, setOpDraft] = useState(() => structuredClone(operationalInfo));
  const [areasText, setAreasText] = useState(() => operationalInfo.areaJangkauanSurvei.join(', '));

  const isMobile = useIsMobileViewport();
  const { mode: viewMode, toggleMode: toggleViewMode } = useMobileFormViewMode();
  const { scrollMainToTop } = useAdminScrollControl();
  const isMobileTabMode = isMobile && viewMode === 'tab';
  const [activeTabId, setActiveTabId] = useState<string>('identitas');

  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMemberData | null>(null);

  const ownerPreviewSrc =
    useCachedMediaSrc(bizDraft.drafPemilik.jalurFoto) ?? bizDraft.drafPemilik.jalurFoto;

  const handleUploadOwnerPhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !canEditBisnis) return;
    try {
      const dataUrl = await readResizedPortraitDataUrl(file, 760);
      setBizDraft((prev) => ({
        ...prev,
        drafPemilik: {
          ...prev.drafPemilik,
          jalurFoto: dataUrl,
          teksAltFoto: prev.drafPemilik.teksAltFoto || `Foto profil ${prev.drafPemilik.namaPemilik}`,
        },
      }));
      setFeedback({
        type: 'ok',
        text: 'Foto pemilik dimuat ke pratinjau. Klik Simpan Perubahan untuk menyimpan.',
      });
    } catch {
      setFeedback({ type: 'err', text: 'Gagal memproses foto pemilik.' });
    }
    event.target.value = '';
  };

  const handleOpenAddMember = () => {
    if (!canEditTentang) return;
    setEditingMember(null);
    setMemberModalOpen(true);
  };

  const handleOpenEditMember = (member: TeamMemberData) => {
    if (!canEditTentang) return;
    setEditingMember(member);
    setMemberModalOpen(true);
  };

  const handleSaveTeamMember = (member: TeamMemberData, isEdit: boolean) => {
    if (!canEditTentang) return;
    const nextMembers = upsertTeamMemberList(tentangDraft.anggotaTim, member);
    setTentangDraft((prev) => ({
      ...prev,
      anggotaTim: nextMembers,
    }));
    updateTentang({
      ...tentang,
      anggotaTim: nextMembers,
    });
    recordActivity(
      isEdit ? 'Memperbarui anggota tim' : 'Menambahkan anggota tim baru',
      'Profil Usaha',
      member.nama
    );
    setMemberModalOpen(false);
    setEditingMember(null);
    setFeedback({
      type: 'ok',
      text: isEdit
        ? `Data tim "${member.nama}" berhasil diperbarui.`
        : `Anggota tim "${member.nama}" berhasil ditambahkan.`,
    });
  };

  const handleDeleteMember = (member: TeamMemberData) => {
    if (!canEditTentang) return;
    const nextMembers = tentangDraft.anggotaTim.filter((item) => item.id !== member.id);
    setTentangDraft((prev) => ({
      ...prev,
      anggotaTim: nextMembers,
    }));
    updateTentang({
      ...tentang,
      anggotaTim: nextMembers,
    });
    recordActivity('Menghapus anggota tim', 'Profil Usaha', member.nama);
    setFeedback({
      type: 'ok',
      text: `Anggota tim "${member.nama}" dihapus.`,
    });
  };

  const handleSaveAll = (event: FormEvent) => {
    event.preventDefault();
    if (!canSave) return;

    let savedBrandName = businessConfig.namaMerek;

    if (canEditBisnis) {
      const nextConfig = buildNormalizedBusinessConfig(bizDraft);
      savedBrandName = nextConfig.namaMerek;
      setBizDraft(nextConfig);
      updateBusinessConfig(nextConfig);
    }

    if (canEditTentang) {
      const nextTentang = buildNormalizedTentangContent(
        tentangDraft,
        paragraphsText,
        missionItemsText
      );
      setTentangDraft(nextTentang);
      updateTentang(nextTentang);
      updateBeranda(berandaDraft);
    }

    if (canEditOperasional) {
      const nextOperational = buildNormalizedOperationalInfo(opDraft, areasText);
      setOpDraft(nextOperational);
      updateOperationalInfo(nextOperational);
    }

    recordActivity(
      'Memperbarui Profil Usaha, Beranda & Operasional',
      'Profil Usaha',
      savedBrandName
    );
    setFeedback({
      type: 'ok',
      text: 'Seluruh perubahan Profil Usaha, Tim, Beranda, dan Operasional berhasil disimpan.',
    });
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      <AdminPageHeader
        title="Profil Usaha"
        actions={
          <>
            {canSave && (
              <span className="hidden md:inline-flex">
                <AdminActionButton
                  type="submit"
                  form="admin-profil-usaha-form"
                  variant="primary"
                  size="sm"
                  iconOnly
                  icon={<Save className="size-4" />}
                  label="Simpan Perubahan"
                  data-testid="desktop-header-submit-btn"
                />
              </span>
            )}
            <AdminMobileViewModeToggle mode={viewMode} onToggle={toggleViewMode} />
          </>
        }
      />

      {isMobileTabMode && (
        <AdminMobileTabBar
          tabs={PROFIL_USAHA_MOBILE_TABS}
          activeTabId={activeTabId}
          tabIdPrefix="tentang-tab"
          panelIdPrefix="tentang-panel"
          onSelectTab={(nextTabId) => {
            setActiveTabId(nextTabId);
            scrollMainToTop();
          }}
        />
      )}

      <AdminFeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

      <FormFieldStyleProvider labelTone="thin" hideHints>
        <div className="[&_input]:font-medium [&_textarea]:font-medium">
          <form
            id="admin-profil-usaha-form"
            onSubmit={handleSaveAll}
            className="grid grid-cols-1 gap-5 sm:gap-6 max-w-6xl [&>*]:min-w-0"
          >
        {/* 1. IDENTITAS & KONTAK */}
        <div
          id={isMobileTabMode ? 'tentang-panel-identitas' : 'bagian-identitas'}
          role={isMobileTabMode ? 'tabpanel' : undefined}
          aria-labelledby={isMobileTabMode ? 'tentang-tab-identitas' : undefined}
          className={
            isMobileTabMode && activeTabId !== 'identitas' ? 'hidden' : 'scroll-mt-4'
          }
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
              <div className="sm:col-span-2">
                <FormField id="biz-tagline" label="Tagline">
                  <Input
                    id="biz-tagline"
                    disabled={!canEditBisnis}
                    value={bizDraft.drafSlogan}
                    onChange={(e) => setBizDraft((p) => ({ ...p, drafSlogan: e.target.value }))}
                  />
                </FormField>
              </div>
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
        </div>

        {/* 2. NARASI STUDIO, VISI & MISI, STATISTIK WORKSHOP */}
        <div
          id={isMobileTabMode ? 'tentang-panel-profil' : 'bagian-narasi'}
          role={isMobileTabMode ? 'tabpanel' : undefined}
          aria-labelledby={isMobileTabMode ? 'tentang-tab-profil' : undefined}
          className={
            isMobileTabMode && activeTabId !== 'profil'
              ? 'hidden'
              : 'scroll-mt-4 space-y-5 sm:space-y-6'
          }
        >
          <AdminFormSectionCard title="Narasi Studio">
            {!canEditTentang && (
              <div className="p-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] text-xs text-[var(--text-muted)]">
                Kolom narasi, visi/misi, tim, dan beranda hanya-baca (butuh izin `tentang.edit`).
              </div>
            )}

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
                      aria-label={`Nilai statistik ${idx + 1}`}
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
                      aria-label={`Label statistik ${idx + 1}`}
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
                    aria-label={`Keterangan statistik ${idx + 1}`}
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
        </div>

        {/* 3. PROFIL PEMILIK & DAFTAR TIM */}
        <div
          id={isMobileTabMode ? 'tentang-panel-pemilik-tim' : 'bagian-pemilik-tim'}
          role={isMobileTabMode ? 'tabpanel' : undefined}
          aria-labelledby={isMobileTabMode ? 'tentang-tab-pemilik-tim' : undefined}
          className={
            isMobileTabMode && activeTabId !== 'pemilik-tim'
              ? 'hidden'
              : 'scroll-mt-4 space-y-5 sm:space-y-6'
          }
        >
          <AdminFormSectionCard title="Profil Pemilik">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-4 space-y-3">
                <div className="rounded-[var(--radius-lg)] overflow-hidden border border-[var(--border)] bg-[var(--surface-muted)]">
                  <ImageFallback
                    src={bizDraft.drafPemilik.jalurFoto ? ownerPreviewSrc : null}
                    alt={bizDraft.drafPemilik.teksAltFoto || bizDraft.drafPemilik.namaPemilik}
                    aspectRatio="4/3"
                    fallbackLabel={bizDraft.drafPemilik.namaPemilik || 'Foto Owner'}
                    className="rounded-none border-0"
                  />
                </div>

                {canEditBisnis && (
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-9 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-xs font-medium text-[var(--text)] hover:bg-[var(--surface-muted)] cursor-pointer">
                      <ImagePlus className="size-3.5" aria-hidden="true" />
                      <span>Unggah Foto</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleUploadOwnerPhoto}
                        className="sr-only"
                      />
                    </label>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() =>
                        setBizDraft((p) => ({
                          ...p,
                          drafPemilik: {
                            ...p.drafPemilik,
                            jalurFoto: '/owner.png',
                          },
                        }))
                      }
                    >
                      <RotateCcw className="size-3.5" aria-hidden="true" />
                      <span>Reset</span>
                    </Button>
                  </div>
                )}
              </div>

              <div className="lg:col-span-8 space-y-4">
                <Checkbox
                  id="own-verified"
                  label="Tampilkan ke Publik"
                  disabled={!canEditBisnis}
                  checked={bizDraft.drafPemilik.terverifikasi}
                  onChange={(e) =>
                    setBizDraft((p) => ({
                      ...p,
                      drafPemilik: { ...p.drafPemilik, terverifikasi: e.target.checked },
                    }))
                  }
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField id="own-name" label="Nama Pemilik">
                    <Input
                      id="own-name"
                      disabled={!canEditBisnis}
                      value={bizDraft.drafPemilik.namaPemilik}
                      onChange={(e) =>
                        setBizDraft((p) => ({
                          ...p,
                          drafPemilik: { ...p.drafPemilik, namaPemilik: e.target.value },
                        }))
                      }
                    />
                  </FormField>
                  <FormField id="own-role" label="Jabatan">
                    <Input
                      id="own-role"
                      disabled={!canEditBisnis}
                      value={bizDraft.drafPemilik.jabatanPemilik}
                      onChange={(e) =>
                        setBizDraft((p) => ({
                          ...p,
                          drafPemilik: { ...p.drafPemilik, jabatanPemilik: e.target.value },
                        }))
                      }
                    />
                  </FormField>
                  <FormField id="own-portrait-path" label="Path / URL Foto">
                    <Input
                      id="own-portrait-path"
                      disabled={!canEditBisnis}
                      value={bizDraft.drafPemilik.jalurFoto}
                      onChange={(e) =>
                        setBizDraft((p) => ({
                          ...p,
                          drafPemilik: { ...p.drafPemilik, jalurFoto: e.target.value },
                        }))
                      }
                    />
                  </FormField>
                  <FormField id="own-portrait-alt" label="Alt Foto">
                    <Input
                      id="own-portrait-alt"
                      disabled={!canEditBisnis}
                      value={bizDraft.drafPemilik.teksAltFoto}
                      onChange={(e) =>
                        setBizDraft((p) => ({
                          ...p,
                          drafPemilik: { ...p.drafPemilik, teksAltFoto: e.target.value },
                        }))
                      }
                    />
                  </FormField>
                </div>

                <FormField id="own-quote" label="Kutipan">
                  <Textarea
                    id="own-quote"
                    rows={2}
                    disabled={!canEditBisnis}
                    value={bizDraft.drafPemilik.kutipanPemilik}
                    onChange={(e) =>
                      setBizDraft((p) => ({
                        ...p,
                        drafPemilik: { ...p.drafPemilik, kutipanPemilik: e.target.value },
                      }))
                    }
                  />
                </FormField>
              </div>
            </div>
          </AdminFormSectionCard>

          <AdminFormSectionCard
            title={`Daftar Anggota Tim (${tentangDraft.anggotaTim.length})`}
            headerAction={
              canEditTentang ? (
                <AdminActionButton
                  variant="default"
                  icon={<Plus className="size-3.5" />}
                  label="Tambah Anggota"
                  hideLabelOnMobile={false}
                  onClick={handleOpenAddMember}
                />
              ) : undefined
            }
          >
            {tentangDraft.anggotaTim.length === 0 ? (
              <div className="p-8 text-center text-xs text-[var(--text-muted)]">
                Belum ada anggota tim terdaftar.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {tentangDraft.anggotaTim.map((member) => (
                  <article
                    key={member.id}
                    className="p-4 border border-[var(--border)] bg-[var(--bg)] rounded-[var(--radius-md)] flex flex-col justify-between gap-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <TeamMemberAvatarPreview member={member} />
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-[var(--text)] truncate">
                            {member.nama}
                          </h3>
                          <p className="text-xs text-[var(--text-muted)] truncate">
                            {member.jabatan}
                          </p>
                        </div>
                      </div>

                      <span className="text-[11px] font-medium text-[var(--text-subtle)] shrink-0">
                        {member.fotoProfil ? 'Ada Foto' : 'Inisial'}
                      </span>
                    </div>

                    {canEditTentang && (
                      <div className="pt-2.5 border-t border-[var(--border)] flex items-center justify-end gap-1.5">
                        <AdminActionButton
                          aria-label={`Edit anggota ${member.nama}`}
                          label="Edit"
                          hideLabelOnMobile={false}
                          icon={<Pencil className="size-3.5" />}
                          onClick={() => handleOpenEditMember(member)}
                        />
                        <AdminActionButton
                          variant="danger"
                          iconOnly
                          label={`Hapus anggota ${member.nama}`}
                          icon={<Trash2 className="size-3.5" />}
                          onClick={() => handleDeleteMember(member)}
                        />
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </AdminFormSectionCard>
        </div>

        {/* 4. KONTEN BERANDA (HERO & JUDUL SEKSI) */}
        <div
          id={isMobileTabMode ? 'tentang-panel-beranda' : 'bagian-beranda'}
          role={isMobileTabMode ? 'tabpanel' : undefined}
          aria-labelledby={isMobileTabMode ? 'tentang-tab-beranda' : undefined}
          className={
            isMobileTabMode && activeTabId !== 'beranda'
              ? 'hidden'
              : 'scroll-mt-4 space-y-5 sm:space-y-6'
          }
        >
          <AdminFormSectionCard title="Hero Beranda">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField id="h-eyebrow" label="Eyebrow">
                <Input
                  id="h-eyebrow"
                  disabled={!canEditTentang}
                  value={berandaDraft.labelHero}
                  onChange={(e) => setBerandaDraft((p) => ({ ...p, labelHero: e.target.value }))}
                />
              </FormField>
              <FormField id="h-title1" label="Judul Baris 1">
                <Input
                  id="h-title1"
                  disabled={!canEditTentang}
                  value={berandaDraft.judulHero}
                  onChange={(e) => setBerandaDraft((p) => ({ ...p, judulHero: e.target.value }))}
                />
              </FormField>
              <FormField id="h-title2" label="Judul Baris 2">
                <Input
                  id="h-title2"
                  disabled={!canEditTentang}
                  value={berandaDraft.judulHeroBarisDua}
                  onChange={(e) =>
                    setBerandaDraft((p) => ({ ...p, judulHeroBarisDua: e.target.value }))
                  }
                />
              </FormField>
              <FormField id="h-desc1" label="Subjudul Baris 1">
                <Input
                  id="h-desc1"
                  disabled={!canEditTentang}
                  value={berandaDraft.deskripsiHero}
                  onChange={(e) =>
                    setBerandaDraft((p) => ({ ...p, deskripsiHero: e.target.value }))
                  }
                />
              </FormField>
              <FormField id="h-desc2" label="Subjudul Baris 2">
                <Input
                  id="h-desc2"
                  disabled={!canEditTentang}
                  value={berandaDraft.deskripsiHeroBarisDua}
                  onChange={(e) =>
                    setBerandaDraft((p) => ({
                      ...p,
                      deskripsiHeroBarisDua: e.target.value,
                    }))
                  }
                />
              </FormField>
            </div>
          </AdminFormSectionCard>

          <AdminFormSectionCard title="Judul Seksi Beranda">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField id="sec-pf-eyebrow" label="Eyebrow Portofolio">
                <Input
                  id="sec-pf-eyebrow"
                  disabled={!canEditTentang}
                  value={berandaDraft.labelPortofolio}
                  onChange={(e) =>
                    setBerandaDraft((p) => ({ ...p, labelPortofolio: e.target.value }))
                  }
                />
              </FormField>
              <FormField id="sec-pf-title" label="Judul Portofolio">
                <Input
                  id="sec-pf-title"
                  disabled={!canEditTentang}
                  value={berandaDraft.judulPortofolio}
                  onChange={(e) =>
                    setBerandaDraft((p) => ({ ...p, judulPortofolio: e.target.value }))
                  }
                />
              </FormField>

              <FormField id="sec-feat-eyebrow" label="Eyebrow Koleksi">
                <Input
                  id="sec-feat-eyebrow"
                  disabled={!canEditTentang}
                  value={berandaDraft.labelUnggulan}
                  onChange={(e) =>
                    setBerandaDraft((p) => ({ ...p, labelUnggulan: e.target.value }))
                  }
                />
              </FormField>
              <FormField id="sec-feat-title" label="Judul Koleksi">
                <Input
                  id="sec-feat-title"
                  disabled={!canEditTentang}
                  value={berandaDraft.judulUnggulan}
                  onChange={(e) =>
                    setBerandaDraft((p) => ({ ...p, judulUnggulan: e.target.value }))
                  }
                />
              </FormField>

              <FormField id="sec-val-eyebrow" label="Eyebrow Keunggulan">
                <Input
                  id="sec-val-eyebrow"
                  disabled={!canEditTentang}
                  value={berandaDraft.labelKeunggulan}
                  onChange={(e) =>
                    setBerandaDraft((p) => ({ ...p, labelKeunggulan: e.target.value }))
                  }
                />
              </FormField>
              <FormField id="sec-val-title" label="Judul Keunggulan">
                <Input
                  id="sec-val-title"
                  disabled={!canEditTentang}
                  value={berandaDraft.judulKeunggulan}
                  onChange={(e) =>
                    setBerandaDraft((p) => ({ ...p, judulKeunggulan: e.target.value }))
                  }
                />
              </FormField>

              <FormField id="sec-proc-eyebrow" label="Eyebrow Alur Kerja">
                <Input
                  id="sec-proc-eyebrow"
                  disabled={!canEditTentang}
                  value={berandaDraft.labelProses}
                  onChange={(e) => setBerandaDraft((p) => ({ ...p, labelProses: e.target.value }))}
                />
              </FormField>
              <FormField id="sec-proc-title" label="Judul Alur Kerja">
                <Input
                  id="sec-proc-title"
                  disabled={!canEditTentang}
                  value={berandaDraft.judulProses}
                  onChange={(e) => setBerandaDraft((p) => ({ ...p, judulProses: e.target.value }))}
                />
              </FormField>

              <FormField id="sec-testi-eyebrow" label="Eyebrow Testimoni">
                <Input
                  id="sec-testi-eyebrow"
                  disabled={!canEditTentang}
                  value={berandaDraft.labelTestimoni}
                  onChange={(e) =>
                    setBerandaDraft((p) => ({ ...p, labelTestimoni: e.target.value }))
                  }
                />
              </FormField>
              <FormField id="sec-testi-title" label="Judul Testimoni">
                <Input
                  id="sec-testi-title"
                  disabled={!canEditTentang}
                  value={berandaDraft.judulTestimoni}
                  onChange={(e) =>
                    setBerandaDraft((p) => ({ ...p, judulTestimoni: e.target.value }))
                  }
                />
              </FormField>
            </div>

            <FormField id="sec-proc-desc" label="Deskripsi Alur Kerja">
              <Textarea
                id="sec-proc-desc"
                rows={2}
                disabled={!canEditTentang}
                value={berandaDraft.deskripsiProses}
                onChange={(e) => setBerandaDraft((p) => ({ ...p, deskripsiProses: e.target.value }))}
              />
            </FormField>
          </AdminFormSectionCard>
        </div>

        {/* 5. KEUNGGULAN KERJA */}
        <div
          id={isMobileTabMode ? 'tentang-panel-keunggulan' : 'bagian-keunggulan'}
          role={isMobileTabMode ? 'tabpanel' : undefined}
          aria-labelledby={isMobileTabMode ? 'tentang-tab-keunggulan' : undefined}
          className={
            isMobileTabMode && activeTabId !== 'keunggulan' ? 'hidden' : 'scroll-mt-4'
          }
        >
          <AdminFormSectionCard title="Keunggulan Kerja">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {berandaDraft.daftarKeunggulan.map((item, idx) => (
                <div
                  key={item.id}
                  className="p-3.5 sm:p-4 border border-[var(--border)] rounded-[var(--radius-md)] space-y-2.5"
                >
                  <p className="text-xs font-medium text-[var(--text-muted)] tabular-nums">
                    Poin {item.nomor}
                  </p>
                  <FormField id={`keunggulan-title-${item.id}`} label="Judul">
                    <Input
                      id={`keunggulan-title-${item.id}`}
                      disabled={!canEditTentang}
                      value={item.judul}
                      onChange={(e) =>
                        setBerandaDraft((p) => ({
                          ...p,
                          daftarKeunggulan: p.daftarKeunggulan.map((row, i) =>
                            i === idx ? { ...row, judul: e.target.value } : row
                          ),
                        }))
                      }
                    />
                  </FormField>
                  <FormField id={`keunggulan-desc-${item.id}`} label="Ringkasan">
                    <Textarea
                      id={`keunggulan-desc-${item.id}`}
                      rows={2}
                      disabled={!canEditTentang}
                      value={item.deskripsi}
                      onChange={(e) =>
                        setBerandaDraft((p) => ({
                          ...p,
                          daftarKeunggulan: p.daftarKeunggulan.map((row, i) =>
                            i === idx ? { ...row, deskripsi: e.target.value } : row
                          ),
                        }))
                      }
                    />
                  </FormField>
                  <FormField id={`keunggulan-detail-${item.id}`} label="Detail Modal">
                    <Textarea
                      id={`keunggulan-detail-${item.id}`}
                      rows={2}
                      disabled={!canEditTentang}
                      value={item.detail ?? ''}
                      onChange={(e) =>
                        setBerandaDraft((p) => ({
                          ...p,
                          daftarKeunggulan: p.daftarKeunggulan.map((row, i) =>
                            i === idx ? { ...row, detail: e.target.value } : row
                          ),
                        }))
                      }
                    />
                  </FormField>
                </div>
              ))}
            </div>
          </AdminFormSectionCard>
        </div>

        {/* 6. ALUR KERJA */}
        <div
          id={isMobileTabMode ? 'tentang-panel-alur-kerja' : 'bagian-alur-kerja'}
          role={isMobileTabMode ? 'tabpanel' : undefined}
          aria-labelledby={isMobileTabMode ? 'tentang-tab-alur-kerja' : undefined}
          className={
            isMobileTabMode && activeTabId !== 'alur-kerja' ? 'hidden' : 'scroll-mt-4'
          }
        >
          <AdminFormSectionCard title="Alur Kerja">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {berandaDraft.tahapanProses.map((step, idx) => (
                <div
                  key={step.id}
                  className="p-3.5 sm:p-4 border border-[var(--border)] rounded-[var(--radius-md)] space-y-2.5"
                >
                  <p className="text-xs font-medium text-[var(--text-muted)] tabular-nums">
                    Tahap {step.nomor}
                  </p>
                  <FormField id={`proses-title-${step.id}`} label="Judul">
                    <Input
                      id={`proses-title-${step.id}`}
                      disabled={!canEditTentang}
                      value={step.judul}
                      onChange={(e) =>
                        setBerandaDraft((p) => ({
                          ...p,
                          tahapanProses: p.tahapanProses.map((item, i) =>
                            i === idx ? { ...item, judul: e.target.value } : item
                          ),
                        }))
                      }
                    />
                  </FormField>
                  <FormField id={`proses-desc-${step.id}`} label="Ringkasan">
                    <Textarea
                      id={`proses-desc-${step.id}`}
                      rows={2}
                      disabled={!canEditTentang}
                      value={step.deskripsi}
                      onChange={(e) =>
                        setBerandaDraft((p) => ({
                          ...p,
                          tahapanProses: p.tahapanProses.map((item, i) =>
                            i === idx ? { ...item, deskripsi: e.target.value } : item
                          ),
                        }))
                      }
                    />
                  </FormField>
                  <FormField id={`proses-detail-${step.id}`} label="Detail Modal">
                    <Textarea
                      id={`proses-detail-${step.id}`}
                      rows={3}
                      disabled={!canEditTentang}
                      value={step.detail ?? ''}
                      onChange={(e) =>
                        setBerandaDraft((p) => ({
                          ...p,
                          tahapanProses: p.tahapanProses.map((item, i) =>
                            i === idx ? { ...item, detail: e.target.value } : item
                          ),
                        }))
                      }
                    />
                  </FormField>
                </div>
              ))}
            </div>
          </AdminFormSectionCard>
        </div>

        {/* 7. OPERASIONAL & LAYANAN */}
        <div
          id={isMobileTabMode ? 'tentang-panel-layanan' : 'bagian-operasional'}
          role={isMobileTabMode ? 'tabpanel' : undefined}
          aria-labelledby={isMobileTabMode ? 'tentang-tab-layanan' : undefined}
          className={
            isMobileTabMode && activeTabId !== 'layanan' ? 'hidden' : 'scroll-mt-4'
          }
        >
          <AdminFormSectionCard title="Operasional & Ketentuan Layanan">
            {!canEditOperasional && (
              <div className="p-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] text-xs text-[var(--text-muted)]">
                Kolom ini hanya-baca (butuh akses Editor pada halaman Profil Usaha).
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField id="op-hours" label="Jam Operasional">
                <Input
                  id="op-hours"
                  disabled={!canEditOperasional}
                  value={opDraft.jamOperasional}
                  onChange={(e) => setOpDraft((p) => ({ ...p, jamOperasional: e.target.value }))}
                />
              </FormField>
              <FormField id="op-survey" label="Jadwal Survei">
                <Input
                  id="op-survey"
                  disabled={!canEditOperasional}
                  value={opDraft.catatanJadwalSurvei}
                  onChange={(e) =>
                    setOpDraft((p) => ({ ...p, catatanJadwalSurvei: e.target.value }))
                  }
                />
              </FormField>
              <FormField id="op-lead" label="Estimasi Produksi">
                <Input
                  id="op-lead"
                  disabled={!canEditOperasional}
                  value={opDraft.estimasiWaktuProduksi}
                  onChange={(e) =>
                    setOpDraft((p) => ({ ...p, estimasiWaktuProduksi: e.target.value }))
                  }
                />
              </FormField>
              <FormField id="op-warranty" label="Ringkasan Garansi">
                <Input
                  id="op-warranty"
                  disabled={!canEditOperasional}
                  value={opDraft.ringkasanGaransi}
                  onChange={(e) => setOpDraft((p) => ({ ...p, ringkasanGaransi: e.target.value }))}
                />
              </FormField>
            </div>

            <FormField id="op-areas" label="Area Survei (pisahkan koma)">
              <Input
                id="op-areas"
                disabled={!canEditOperasional}
                value={areasText}
                onChange={(e) => setAreasText(e.target.value)}
              />
            </FormField>
          </AdminFormSectionCard>
        </div>

          </form>
        </div>
      </FormFieldStyleProvider>

      {canSave && (
        <AdminMobileBottomAction>
          <nav aria-label="Aksi simpan seluler">
            <Button
              type="submit"
              form="admin-profil-usaha-form"
              variant="primary"
              size="md"
              fullWidth
              data-testid="mobile-bottom-submit-btn"
            >
              Simpan
            </Button>
          </nav>
        </AdminMobileBottomAction>
      )}

      <TeamMemberModal
        isOpen={memberModalOpen}
        editingMember={editingMember}
        onClose={() => {
          setMemberModalOpen(false);
          setEditingMember(null);
        }}
        onSaveMember={handleSaveTeamMember}
      />
    </div>
  );
}
