import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT_DIR = process.cwd();

function readProjectFile(relPath: string): string {
  return fs.readFileSync(path.join(ROOT_DIR, relPath), 'utf8');
}

function collectTsxFiles(dirRel: string): string[] {
  const results: string[] = [];
  const absDir = path.join(ROOT_DIR, dirRel);
  for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
    const nextRel = path.join(dirRel, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectTsxFiles(nextRel));
    } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
      results.push(nextRel);
    }
  }
  return results.sort();
}

const STANDARD_ADMIN_FORM_FILES = [
  'src/pages/admin/proyek/form.tsx',
  'src/pages/admin/informasi/berita/form.tsx',
  'src/pages/admin/portofolio/proyek/form.tsx',
  'src/pages/admin/katalog/produk/form.tsx',
  'src/pages/admin/informasi/material/form.tsx',
  'src/pages/admin/informasi/faq/form.tsx',
  'src/pages/admin/keuangan/buku-kas/form.tsx',
  'src/pages/admin/keuangan/pembelian/form.tsx',
  'src/pages/admin/akses/pengguna/form.tsx',
  'src/pages/admin/marketing/database/form.tsx',
  'src/pages/admin/marketing/campaign/form.tsx',
  'src/pages/admin/marketing/content-plan/form.tsx',
  'src/pages/admin/dokumen/penawaran/form.tsx',
  'src/pages/admin/dokumen/spk/form.tsx',
  'src/pages/admin/dokumen/spks/form.tsx',
  'src/pages/admin/dokumen/surat-jalan/form.tsx',
  'src/pages/admin/dokumen/bast/form.tsx',
  'src/pages/admin/dokumen/invoice/form.tsx',
  'src/pages/admin/dokumen/invoice/payment-form.tsx',
  'src/pages/admin/tentang/index.tsx',
  'src/pages/admin/tentang/team-member-modal.tsx',
  'src/pages/admin/seo/index.tsx',
  'src/pages/admin/seo/seo-section.tsx',
  'src/pages/admin/marketing/campaign/send.tsx',
  'src/pages/admin/keuangan/skema-pembayaran-panel.tsx',
] as const;

test('core form components enforce accent header defaults, auto title alignment, thin labels, and hidden hints', () => {
  const adminFormSrc = readProjectFile('src/components/admin/admin-form.tsx');
  assert.match(adminFormSrc, /headerVariant = 'accent'/);
  assert.match(adminFormSrc, /actionMode = 'header-icon-mobile-bottom'/);
  assert.match(adminFormSrc, /mobileSubmitLabel = 'Simpan'/);
  assert.match(adminFormSrc, /<FormFieldStyleProvider labelTone="thin" hideHints>/);
  assert.match(adminFormSrc, /\[&_input\]:font-medium \[&_textarea\]:font-medium/);
  assert.match(adminFormSrc, /hasHeaderAction[\s\S]*text-left[\s\S]*text-center/);
  assert.doesNotMatch(adminFormSrc, /text-right|justify-end/);
  assert.doesNotMatch(adminFormSrc, /hint=\{resolvedHint\}/);
  assert.doesNotMatch(adminFormSrc, /description=\{field\.checkboxDescription\}/);
  assert.doesNotMatch(adminFormSrc, /\{description && <p/);

  const formControlsSrc = readProjectFile('src/components/ui/form-controls.tsx');
  assert.match(formControlsSrc, /FormFieldHideHintsContext/);
  assert.match(formControlsSrc, /hideHints = false/);
  assert.match(formControlsSrc, /\{hint && !hideHints && !error &&/);
  assert.match(formControlsSrc, /\{description && !hideHints &&/);

  const wilayahSrc = readProjectFile('src/components/admin/wilayah-address-fields.tsx');
  assert.match(wilayahSrc, /showHints = false/);
});

test('all admin forms comply with zero hints, zero center titleAlign, zero #C4B7A5/#5C4B3E tabs, and standard action placement', () => {
  for (const relPath of STANDARD_ADMIN_FORM_FILES) {
    const src = readProjectFile(relPath);
    assert.doesNotMatch(src, /\bhint\s*[:=]/, `${relPath} still has hint prop`);
    assert.doesNotMatch(src, /checkboxDescription\s*[:=]/, `${relPath} still has checkboxDescription`);
    assert.doesNotMatch(src, /titleAlign\s*:\s*['"]center['"]/, `${relPath} still uses titleAlign: center`);
    assert.doesNotMatch(src, /#[Cc]4[Bb]7[Aa]5|#5[Cc]4[Bb]3[Ee]/, `${relPath} still has legacy tab color`);
    assert.doesNotMatch(src, /actionMode\s*=\s*['"]default['"]/, `${relPath} still overrides actionMode=default`);
  }

  const allAdminTsx = collectTsxFiles('src/pages/admin');
  assert.ok(allAdminTsx.length >= 25);
  for (const relPath of allAdminTsx) {
    const src = readProjectFile(relPath);
    assert.doesNotMatch(src, /<AdminFormSectionCard[^>]*\bdescription=/, `${relPath} passes description to AdminFormSectionCard`);
  }
});

test('custom admin forms implement FormFieldStyleProvider thin labels and desktop/mobile action placement', () => {
  const customForms = [
    'src/pages/admin/tentang/index.tsx',
    'src/pages/admin/seo/seo-section.tsx',
    'src/pages/admin/marketing/campaign/send.tsx',
    'src/pages/admin/keuangan/skema-pembayaran-panel.tsx',
    'src/pages/admin/tentang/team-member-modal.tsx',
  ];
  for (const relPath of customForms) {
    const src = readProjectFile(relPath);
    assert.match(src, /<FormFieldStyleProvider labelTone="thin" hideHints>/, `${relPath} missing FormFieldStyleProvider`);
    assert.match(src, /\[&_input\]:font-medium \[&_textarea\]:font-medium/, `${relPath} missing font-medium input wrapper`);
  }

  const mobileSavePages = [
    'src/pages/admin/tentang/index.tsx',
    'src/pages/admin/seo/index.tsx',
    'src/pages/admin/marketing/campaign/send.tsx',
    'src/pages/admin/keuangan/skema-pembayaran-panel.tsx',
  ];
  for (const relPath of mobileSavePages) {
    const src = readProjectFile(relPath);
    assert.match(src, /<AdminMobileBottomAction>/, `${relPath} missing AdminMobileBottomAction`);
    assert.match(src, /data-testid="mobile-bottom-submit-btn"/, `${relPath} missing mobile-bottom-submit-btn`);
  }

  const desktopIconSavePages = [
    'src/pages/admin/tentang/index.tsx',
    'src/pages/admin/seo/index.tsx',
    'src/pages/admin/marketing/campaign/send.tsx',
    'src/pages/admin/keuangan/index.tsx',
  ];
  for (const relPath of desktopIconSavePages) {
    const src = readProjectFile(relPath);
    assert.match(src, /hidden md:inline-flex/, `${relPath} desktop save button not hidden on mobile`);
    assert.match(src, /data-testid="desktop-header-submit-btn"/, `${relPath} missing desktop-header-submit-btn`);
  }
});

test('admin shell enforces icon-only logout, brand header link to home without Web Publik button, and Terang|Gelap theme tabs below SEO', () => {
  const adminShellSrc = readProjectFile('src/pages/admin/admin-shell.tsx');
  assert.match(adminShellSrc, /data-testid="admin-brand-home-link"/);
  assert.match(adminShellSrc, /const sidebarBrandHeader = \(\s*<Link\s+to="\/"/);
  assert.doesNotMatch(adminShellSrc, /Web Publik/);
  assert.doesNotMatch(adminShellSrc, /<span>Keluar<\/span>/);
  assert.match(adminShellSrc, /data-testid="admin-logout-btn"/);
  assert.match(adminShellSrc, /data-testid="admin-theme-tabs"/);
  assert.match(adminShellSrc, /visibleNavItems\.map[\s\S]*data-testid="admin-theme-tabs"[\s\S]*<\/nav>/);
  assert.match(adminShellSrc, /<span>Terang<\/span>[\s\S]*<span>Gelap<\/span>/);
});

test('admin login removes headers on desktop and mobile, places plain text Kembali Ke Beranda below desktop form card and mobile bottom button', () => {
  const loginSrc = readProjectFile('src/pages/admin/login/index.tsx');
  assert.doesNotMatch(loginSrc, /Kembali ke Situs Publik/);
  assert.doesNotMatch(loginSrc, /Akses Internal/);
  assert.doesNotMatch(loginSrc, /ShieldCheck/);
  assert.doesNotMatch(loginSrc, /<header\b/);
  assert.doesNotMatch(loginSrc, /ThemeToggle/);
  assert.match(
    loginSrc,
    /<\/form>[\s\S]*data-testid="desktop-back-to-home"[\s\S]*>[\s\S]*Kembali Ke Beranda[\s\S]*<\/Link>/
  );
  assert.match(
    loginSrc,
    /data-testid="mobile-login-bottom-submit"[\s\S]*data-testid="mobile-back-to-home"[\s\S]*>[\s\S]*Kembali Ke Beranda[\s\S]*<\/Link>/
  );
  const desktopBackMatch = loginSrc.match(/data-testid="desktop-back-to-home"[\s\S]*?<\/Link>/);
  assert.ok(desktopBackMatch);
  assert.match(desktopBackMatch[0], /no-underline/);
  assert.doesNotMatch(desktopBackMatch[0], /\bborder\b|bg-\[var\(--surface\)\]|<svg|<ArrowLeft|<ChevronLeft/);

  const mobileBackMatch = loginSrc.match(/data-testid="mobile-back-to-home"[\s\S]*?<\/Link>/);
  assert.ok(mobileBackMatch);
  assert.match(mobileBackMatch[0], /no-underline/);
  assert.doesNotMatch(mobileBackMatch[0], /\bborder\b|bg-\[var\(--surface\)\]|<svg|<ArrowLeft|<ChevronLeft/);
  assert.doesNotMatch(loginSrc, /\bLock\b/);
  assert.doesNotMatch(loginSrc, /Portal Administrasi/);
  assert.doesNotMatch(loginSrc, /taglineDraft/);
  assert.doesNotMatch(loginSrc, /border-t border-white\/15|border-r border-\[var\(--border\)\]/);
  assert.match(loginSrc, /id="admin-login-heading"[\s\S]*text-center/);
  assert.match(loginSrc, /mt-auto mb-0 lg:my-auto/);
  assert.match(
    loginSrc,
    /<aside[\s\S]*flex flex-col items-start[\s\S]*\{brandName\}[\s\S]*Interior Design &amp; Building[\s\S]*\{address\.alamatLengkap\}[\s\S]*<\/aside>/
  );
  assert.match(
    loginSrc,
    /<\/aside>[\s\S]*data-testid="desktop-login-copyright"[\s\S]*© \{new Date\(\)\.getFullYear\(\)\} \{brandName\}/
  );
});

test('admin user form places Nama Lengkap & Keterangan on row 1, Email & Kata Sandi on row 2, omits status, and renders 9 access cards with Hide/View/Editor tabs', () => {
  const userFormSrc = readProjectFile('src/pages/admin/akses/pengguna/form.tsx');
  const userListSrc = readProjectFile('src/pages/admin/akses/pengguna/index.tsx');

  assert.doesNotMatch(userFormSrc, /name:\s*['"]status['"]/);
  assert.doesNotMatch(userListSrc, /Aktif|Nonaktif|statusFilter|Status Akun/);

  assert.match(
    userFormSrc,
    /name:\s*['"]nama['"][\s\S]*label:\s*['"]Nama Lengkap['"][\s\S]*name:\s*['"]divisi['"][\s\S]*label:\s*['"]Keterangan['"][\s\S]*name:\s*['"]email['"][\s\S]*label:\s*['"]Email Login['"][\s\S]*name:\s*['"]kataSandi['"][\s\S]*label:\s*['"]Kata Sandi['"]/
  );
  assert.match(userFormSrc, /ACCESS_PAGE_CATALOG\.map/);
  assert.match(userFormSrc, /ACCESS_LEVEL_OPTIONS\.map/);
});

test('mobile form tabs logic enforces default tab mode, inverted toggle icons, cross-tab error matching, and conditional tab fallback', async () => {
  const {
    DEFAULT_MOBILE_FORM_VIEW_MODE,
    doesTabHaveErrors,
    getMobileFormToggleMeta,
    normalizeMobileFormViewMode,
    resolveFirstErrorTabId,
    resolveSafeActiveTabId,
  } = await import('../../../src/components/admin/mobile-form-tabs-logic.ts');

  assert.equal(DEFAULT_MOBILE_FORM_VIEW_MODE, 'tab');
  assert.equal(normalizeMobileFormViewMode(null), 'tab');
  assert.equal(normalizeMobileFormViewMode(undefined), 'tab');
  assert.equal(normalizeMobileFormViewMode('invalid-mode'), 'tab');
  assert.equal(normalizeMobileFormViewMode('list'), 'list');
  assert.equal(normalizeMobileFormViewMode('tab'), 'tab');

  const whenTabMeta = getMobileFormToggleMeta('tab');
  assert.equal(whenTabMeta.iconName, 'list');
  assert.equal(whenTabMeta.nextMode, 'list');
  assert.equal(whenTabMeta.ariaLabel, 'Tampilan list ke bawah');
  assert.equal(whenTabMeta.title, 'Ubah ke tampilan list');

  const whenListMeta = getMobileFormToggleMeta('list');
  assert.equal(whenListMeta.iconName, 'panel-top');
  assert.equal(whenListMeta.nextMode, 'tab');
  assert.equal(whenListMeta.ariaLabel, 'Tampilan tab per bagian');
  assert.equal(whenListMeta.title, 'Ubah ke tampilan tab');

  const tabs = [
    { id: 'klien', fields: ['namaKlien'], errorPrefixes: ['alamat.'] },
    { id: 'produk', fields: [], errorFields: ['daftarProduk'], errorPrefixes: ['daftarProduk.'] },
    { id: 'jadwal', fields: ['tanggalMulai'], errorPrefixes: ['tanggalDokumen.'] },
  ];

  assert.equal(doesTabHaveErrors(tabs[0], { 'alamat.kabupaten': 'Pilih kabupaten.' }, {}), true);
  assert.equal(doesTabHaveErrors(tabs[1], { 'alamat.kabupaten': 'Pilih kabupaten.' }, {}), false);
  assert.equal(doesTabHaveErrors(tabs[1], { daftarProduk: 'Minimal 1 item.' }, {}), true);
  assert.equal(doesTabHaveErrors(tabs[2], { 'tanggalDokumen.spk': '   ' }, {}), false);

  assert.equal(
    resolveFirstErrorTabId(tabs, 'klien', { 'tanggalDokumen.spk': 'Tanggal tidak valid.' }, {}),
    'jadwal'
  );
  assert.equal(
    resolveFirstErrorTabId(
      tabs,
      'produk',
      { daftarProduk: 'Wajib 1 item.', 'tanggalDokumen.spk': 'Invalid' },
      {}
    ),
    'produk'
  );
  assert.equal(resolveFirstErrorTabId(tabs, 'klien', {}, {}), null);

  assert.equal(resolveSafeActiveTabId([{ id: 'klasifikasi' }, { id: 'nominal' }], 'termin'), 'klasifikasi');
  assert.equal(resolveSafeActiveTabId([{ id: 'klasifikasi' }, { id: 'nominal' }], 'nominal'), 'nominal');
});

test('mobile form tabs infrastructure, all 18 multi-section AdminForm pages, custom forms, and pengaturan sticky header follow contracts', () => {
  const adminShellSrc = readProjectFile('src/pages/admin/admin-shell.tsx');
  assert.match(adminShellSrc, /export function AdminMobileSubHeader/);
  assert.match(adminShellSrc, /export function useAdminScrollControl/);
  assert.match(
    adminShellSrc,
    /<\/header>[\s\S]*data-testid="admin-mobile-subheader-host"[\s\S]*<main/
  );

  const mobileTabsSrc = readProjectFile('src/components/admin/mobile-form-tabs.tsx');
  assert.match(mobileTabsSrc, /mode === 'tab' \? \(\s*<List\b/);
  assert.match(mobileTabsSrc, /<PanelTop\b/);
  assert.match(mobileTabsSrc, /app-scroll-region/);
  assert.match(mobileTabsSrc, /overflow-x-auto/);
  assert.match(mobileTabsSrc, /flex-1 shrink-0 min-w-max/);
  assert.doesNotMatch(mobileTabsSrc, /isCompactCount/);
  assert.match(mobileTabsSrc, /scrollIntoView/);
  assert.match(mobileTabsSrc, /bg-\[var\(--danger\)\]/);

  const adminFormSrc = readProjectFile('src/components/admin/admin-form.tsx');
  assert.match(adminFormSrc, /showMobileToggle\s*&&\s*<AdminMobileViewModeToggle/);
  assert.match(adminFormSrc, /desktop-header-submit-btn[\s\S]*showMobileToggle\s*&&\s*<AdminMobileViewModeToggle/);
  assert.match(adminFormSrc, /isMobileTabMode\s*&&\s*\(\s*<AdminMobileTabBar/);
  assert.match(adminFormSrc, /resolveFirstErrorTabId/);
  assert.match(adminFormSrc, /scrollMainToFirstError/);

  const faqSrc = readProjectFile('src/pages/admin/informasi/faq/form.tsx');
  assert.equal((faqSrc.match(/\bid:\s*'/g) ?? []).length, 1);
  assert.doesNotMatch(faqSrc, /\baside\s*=/);

  const multiSectionAdminForms = [
    'src/pages/admin/proyek/form.tsx',
    'src/pages/admin/informasi/berita/form.tsx',
    'src/pages/admin/portofolio/proyek/form.tsx',
    'src/pages/admin/katalog/produk/form.tsx',
    'src/pages/admin/informasi/material/form.tsx',
    'src/pages/admin/keuangan/buku-kas/form.tsx',
    'src/pages/admin/keuangan/pembelian/form.tsx',
    'src/pages/admin/akses/pengguna/form.tsx',
    'src/pages/admin/marketing/database/form.tsx',
    'src/pages/admin/marketing/campaign/form.tsx',
    'src/pages/admin/marketing/content-plan/form.tsx',
    'src/pages/admin/dokumen/penawaran/form.tsx',
    'src/pages/admin/dokumen/spk/form.tsx',
    'src/pages/admin/dokumen/spks/form.tsx',
    'src/pages/admin/dokumen/surat-jalan/form.tsx',
    'src/pages/admin/dokumen/bast/form.tsx',
    'src/pages/admin/dokumen/invoice/form.tsx',
    'src/pages/admin/dokumen/invoice/payment-form.tsx',
  ];
  for (const relPath of multiSectionAdminForms) {
    const src = readProjectFile(relPath);
    assert.match(src, /mobileTabLabel:/, `${relPath} missing mobileTabLabel`);
  }

  for (const customHeaderPage of [
    'src/pages/admin/tentang/index.tsx',
    'src/pages/admin/seo/index.tsx',
    'src/pages/admin/marketing/campaign/send.tsx',
    'src/pages/admin/keuangan/index.tsx',
  ]) {
    const src = readProjectFile(customHeaderPage);
    assert.match(src, /useMobileFormViewMode/, `${customHeaderPage} missing useMobileFormViewMode`);
    assert.match(src, /<AdminMobileViewModeToggle/, `${customHeaderPage} missing AdminMobileViewModeToggle`);
  }

  assert.match(readProjectFile('src/pages/admin/tentang/index.tsx'), /<AdminMobileTabBar/);
  assert.match(readProjectFile('src/pages/admin/seo/seo-section.tsx'), /<AdminMobileTabBar/);
  assert.match(readProjectFile('src/pages/admin/marketing/campaign/send.tsx'), /<AdminMobileTabBar/);
  assert.match(
    readProjectFile('src/pages/admin/keuangan/skema-pembayaran-panel.tsx'),
    /data-testid="admin-mobile-tablist"/
  );
  assert.match(
    readProjectFile('src/pages/pengaturan/index.tsx'),
    /data-testid="pengaturan-mobile-tablist"[\s\S]*sticky top-0 z-20/
  );
});

test('all mobile admin header top-right action buttons enforce icon-only card styling with zero mobile labels', () => {
  const actionButtonsSrc = readProjectFile('src/components/admin/admin-action-buttons.tsx');
  assert.match(actionButtonsSrc, /HEADER_MOBILE_CARD_CLASSES/);
  assert.match(actionButtonsSrc, /if \(inAdminHeader\)/);
  assert.match(actionButtonsSrc, /if \(inAdminHeader\) \{\s*return <span className="hidden sm:inline">\{label\}<\/span>;\s*\}/);
  assert.doesNotMatch(actionButtonsSrc, /border-0 bg-transparent shadow-none rounded-none/);

  const adminPages = collectTsxFiles('src/pages/admin');
  for (const relPath of adminPages) {
    const src = readProjectFile(relPath);
    const headerActionsMatches = src.match(/<AdminPageHeader[\s\S]*?actions=\{[\s\S]*?\}\s*\/>/g) ?? [];
    for (const headerBlock of headerActionsMatches) {
      assert.doesNotMatch(
        headerBlock,
        /mobileLabel=/,
        `${relPath} passes mobileLabel inside AdminPageHeader actions`
      );
    }
  }
});



