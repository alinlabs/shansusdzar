import { useMemo, useState, type FormEvent } from 'react';
import { CheckSquare, Eye, Lock, RotateCcw } from 'lucide-react';
import { useNavigate, useParams } from 'react-router';
import { AdminActionButton } from '../../../../components/admin/admin-action-buttons';
import { AdminForm, type AdminFormSectionConfig } from '../../../../components/admin/admin-form';
import { useDocumentTitle } from '../../../../hooks/use-document-title';
import {
  ACCESS_LEVEL_OPTIONS,
  ACCESS_PAGE_CATALOG,
  canAssignPageLevel,
  canEditPage,
  canEditTargetUser,
  getPageAccess,
  sanitizePageAccessList,
} from '../../../../lib/rbac';
import { useAdminAuthStore } from '../../../../store/admin-auth-store';
import { useSiteContentStore } from '../../../../store/site-content-store';
import type {
  AdminAccessLevel,
  AdminAccessPageKey,
  AdminUserAccount,
} from '../../../../types/cms';
import { createEmptyUser, normalizeUserPayload, validateUserDraft } from './logic';

const BACK_PATH = '/admin/akses';

export default function AdminAksesPenggunaFormPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  const shortBrandName = useSiteContentStore((state) => state.businessConfig.namaMerek);
  const users = useAdminAuthStore((state) => state.users);
  const sessionUserId = useAdminAuthStore((state) => state.sessionUserId);
  const upsertUser = useAdminAuthStore((state) => state.upsertUser);
  const recordActivity = useAdminAuthStore((state) => state.recordActivity);

  const currentUser = users.find((u) => u.id === sessionUserId) ?? null;
  const canManage = canEditPage(currentUser, 'pengguna');

  const isEditMode = Boolean(id);
  const existingUser = useMemo(
    () => (id ? users.find((u) => u.id === id) ?? null : null),
    [id, users]
  );

  const editAccessGuard = useMemo(
    () => canEditTargetUser(currentUser, existingUser),
    [currentUser, existingUser]
  );

  const isReadOnly = !canManage || !editAccessGuard.allowed;

  const [values, setValues] = useState<AdminUserAccount>(() =>
    existingUser ? structuredClone(existingUser) : createEmptyUser()
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});

  useDocumentTitle(
    `${isEditMode ? 'Edit Pengguna' : 'Tambah Pengguna'} | Admin ${shortBrandName}`
  );

  const handleSetSinglePageAccess = (
    page: AdminAccessPageKey,
    level: AdminAccessLevel
  ) => {
    if (isReadOnly || values.isOwner || !canAssignPageLevel(currentUser, page, level)) return;
    setValues((prev) => {
      const normalized = sanitizePageAccessList(prev.akses);
      return {
        ...prev,
        akses: normalized.map((rule) =>
          rule.halaman === page ? { halaman: page, krendensial: level } : rule
        ),
      };
    });
  };

  const handleSetAllPagesAccess = (level: AdminAccessLevel) => {
    if (isReadOnly || values.isOwner) return;
    setValues((prev) => {
      const normalized = sanitizePageAccessList(prev.akses);
      return {
        ...prev,
        akses: normalized.map((rule) =>
          canAssignPageLevel(currentUser, rule.halaman, level)
            ? { halaman: rule.halaman, krendensial: level }
            : rule
        ),
      };
    });
  };

  const sections = useMemo<AdminFormSectionConfig<AdminUserAccount>[]>(
    () => [
      {
        id: 'akun-pengguna',
        title: 'Identitas Pengguna',
        mobileTabLabel: 'Identitas',
        columns: 2,
        fields: [
          {
            name: 'nama',
            label: 'Nama Lengkap',
            type: 'text',
            required: true,
          },
          {
            name: 'divisi',
            label: 'Keterangan',
            type: 'text',
            placeholder: 'Contoh: Produksi, Keuangan, Dokumentasi',
          },
          {
            name: 'email',
            label: 'Email Login',
            type: 'email',
            required: true,
          },
          {
            name: 'kataSandi',
            label: 'Kata Sandi',
            type: 'text',
            required: true,
          },
        ],
      },
      {
        id: 'akses-modul',
        title: 'Pengaturan Hak Akses',
        mobileTabLabel: 'Hak Akses',
        headerAction: () =>
          !isReadOnly && !values.isOwner ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <AdminActionButton
                variant="ghost"
                icon={<Eye className="size-3.5" />}
                label="Semua View"
                hideLabelOnMobile={false}
                onClick={() => handleSetAllPagesAccess('view')}
              />
              <AdminActionButton
                icon={<CheckSquare className="size-3.5" />}
                label="Semua Editor"
                hideLabelOnMobile={false}
                onClick={() => handleSetAllPagesAccess('editor')}
              />
              <AdminActionButton
                variant="ghost"
                icon={<RotateCcw className="size-3.5" />}
                label="Reset Hide"
                hideLabelOnMobile={false}
                onClick={() => handleSetAllPagesAccess('hide')}
              />
            </div>
          ) : undefined,
        renderContent: (ctx) => (
          <div className="space-y-4">
            {ctx.values.isOwner && (
              <div className="p-3.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)]/60 flex items-center gap-2.5 text-xs text-[var(--text)]">
                <Lock className="size-4 text-[var(--text-muted)] shrink-0" aria-hidden="true" />
                <span>
                  Akun ini adalah <strong>Owner (Akun Super)</strong>. Seluruh halaman otomatis memiliki akses Editor dan tidak dapat dikurangi.
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {ACCESS_PAGE_CATALOG.map((page) => {
                const effectiveLevel = ctx.values.isOwner
                  ? 'editor'
                  : getPageAccess(ctx.values, page.halaman);

                return (
                  <div
                    key={page.halaman}
                    data-testid={`access-card-${page.halaman}`}
                    className="p-3.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)]/50 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3
                        id={`access-title-${page.halaman}`}
                        className="text-xs font-semibold text-[var(--text)]"
                      >
                        {page.label}
                      </h3>
                      {page.halaman === 'pengguna' &&
                        !currentUser?.isOwner &&
                        !ctx.values.isOwner && (
                          <Lock
                            className="size-3.5 text-[var(--text-subtle)] shrink-0"
                            aria-hidden="true"
                          />
                        )}
                    </div>

                    <div
                      role="radiogroup"
                      aria-labelledby={`access-title-${page.halaman}`}
                      className="grid grid-cols-3 gap-1 p-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)]"
                    >
                      {ACCESS_LEVEL_OPTIONS.map((opt) => {
                        const selected = effectiveLevel === opt.value;
                        const disabled =
                          ctx.readOnly ||
                          Boolean(ctx.values.isOwner) ||
                          !canAssignPageLevel(currentUser, page.halaman, opt.value);

                        return (
                          <button
                            key={opt.value}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            disabled={disabled}
                            data-testid={`access-tab-${page.halaman}-${opt.value}`}
                            onClick={() => handleSetSinglePageAccess(page.halaman, opt.value)}
                            className={[
                              'min-h-8 px-2 rounded-[var(--radius-sm)] text-xs transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed',
                              selected
                                ? 'bg-[#312F2E] text-white dark:bg-[var(--accent)] dark:text-[var(--accent-contrast)] font-semibold'
                                : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)] font-medium',
                            ].join(' ')}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [values.isOwner, isReadOnly, currentUser]
  );

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (isReadOnly) return;

    const validation = validateUserDraft(values, users);
    if (!validation.valid) {
      setFormError(validation.formError);
      setFieldErrors(validation.fieldErrors);
      return;
    }

    const payload = normalizeUserPayload(values);
    upsertUser(payload);
    recordActivity(
      isEditMode ? 'Memperbarui akun & hak akses pengguna' : 'Menambahkan akun pengguna',
      'Pengguna',
      payload.email
    );

    navigate(BACK_PATH, {
      state: {
        feedback: {
          type: 'ok',
          text: `Data pengguna "${payload.nama}" berhasil disimpan.`,
        },
      },
    });
  };

  return (
    <AdminForm
      title={isEditMode ? 'Edit Pengguna' : 'Tambah Pengguna'}
      backTo={BACK_PATH}
      backLabel="Kembali ke Pengguna"
      submitLabel="Simpan Pengguna"
      values={values}
      onChange={setValues}
      sections={sections}
      onSubmit={handleSubmit}
      formError={formError}
      fieldErrors={fieldErrors}
      readOnly={isReadOnly}
      readOnlyNotice={
        editAccessGuard.reason ?? 'Akun Anda hanya memiliki akses baca pada halaman ini.'
      }
      notFoundState={
        isEditMode && !existingUser
          ? {
              title: 'Pengguna Tidak Ditemukan',
              message: 'Data pengguna tidak tersedia atau telah dihapus.',
            }
          : undefined
      }
    />
  );
}
