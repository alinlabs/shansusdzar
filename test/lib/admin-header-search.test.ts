import assert from 'node:assert/strict';
import test from 'node:test';
import {
  filterAdminCatalogProducts,
  filterAdminFaqs,
  filterAdminMaterials,
  filterAdminNewsArticles,
  filterAdminPortfolioProjects,
  filterAdminUsers,
} from '../../src/lib/admin-header-search';
import type {
  AdminUserAccount,
  FaqItem,
  MaterialSpecItem,
  NewsArticleItem,
  PortfolioCaseStudy,
} from '../../src/types/cms';
import type { ProductItem } from '../../src/types/product';

test('filterAdminCatalogProducts filters by category and search query', () => {
  const products = [
    {
      id: 'p1',
      slug: 'kitchen-set-minimalis',
      nama: 'Kitchen Set Minimalis',
      kategori: 'Dapur',
      deskripsiSingkat: 'Kabinet dapur HPL',
    },
    {
      id: 'p2',
      slug: 'lemari-sliding',
      nama: 'Lemari Pakaian Sliding',
      kategori: 'Kamar Tidur',
      deskripsiSingkat: 'Lemari pintu geser',
    },
  ] as unknown as ProductItem[];

  assert.equal(filterAdminCatalogProducts(products, '', 'Semua').length, 2);
  assert.equal(filterAdminCatalogProducts(products, '', 'Dapur').length, 1);
  assert.equal(filterAdminCatalogProducts(products, 'sliding', 'Semua')[0]?.id, 'p2');
  assert.equal(filterAdminCatalogProducts(products, 'sliding', 'Dapur').length, 0);
});

test('filterAdminPortfolioProjects filters across title, city, client, and review', () => {
  const projects = [
    {
      id: 'pf1',
      judul: 'Kitchen Set Purwakarta',
      kategori: 'Dapur',
      lokasi: 'Purwakarta',
      ulasan: { sapaan: 'Ibu', klien: 'Sari', komentar: 'Rapi sekali', penilaian: 5 },
    },
    {
      id: 'pf2',
      judul: 'Wardrobe Bandung',
      kategori: 'Kamar',
      lokasi: 'Bandung',
      ulasan: { sapaan: 'Bpk.', klien: 'Budi', komentar: 'Mantap', penilaian: 5 },
    },
  ] as unknown as PortfolioCaseStudy[];

  assert.equal(filterAdminPortfolioProjects(projects, '').length, 2);
  assert.equal(filterAdminPortfolioProjects(projects, 'rapi')[0]?.id, 'pf1');
  assert.equal(filterAdminPortfolioProjects(projects, 'bpk. budi')[0]?.id, 'pf2');
  assert.equal(filterAdminPortfolioProjects(projects, 'bandung')[0]?.id, 'pf2');
});

test('filterAdminNewsArticles filters by category and search query across title, computed slug, keywords, and isi', () => {
  const articles = [
    {
      id: 'news-001',
      judul: 'Tips Memilih HPL',
      kategori: 'Material',
      ringkasan: 'Panduan laminasi tahan lembap',
      isi: [
        {
          jenis: 'teks',
          isi: 'Lapisan dekoratif tahan gores untuk kabinet dapur.',
          format: { gaya: 'paragraf', rata: 'justify' },
        },
      ],
      kataKunciSeo: ['hpl', 'dapur'],
    },
    {
      id: 'news-002',
      judul: 'Konsep Meja Kerja',
      kategori: 'Inspirasi',
      ringkasan: 'Ide ruang kerja',
      isi: [
        {
          jenis: 'teks',
          isi: 'Ergonomi ruang kerja minimalis modern.',
          format: { gaya: 'paragraf', rata: 'justify' },
        },
      ],
      kataKunciSeo: ['kantor'],
    },
  ] as unknown as NewsArticleItem[];

  assert.equal(filterAdminNewsArticles(articles, { search: '', category: 'Semua' }).length, 2);
  assert.equal(filterAdminNewsArticles(articles, { search: '', category: 'Inspirasi' })[0]?.id, 'news-002');
  assert.equal(filterAdminNewsArticles(articles, { search: 'laminasi', category: 'Semua' })[0]?.id, 'news-001');
  assert.equal(filterAdminNewsArticles(articles, { search: 'konsep-meja-kerja', category: 'Semua' })[0]?.id, 'news-002');
  assert.equal(filterAdminNewsArticles(articles, { search: 'ergonomi', category: 'Inspirasi' })[0]?.id, 'news-002');
});

test('filterAdminMaterials filters by category and search keyword', () => {
  const materials = [
    {
      id: 'm1',
      nama: 'Plywood Meranti',
      kategori: 'papan',
      ringkasan: 'Rangka kuat',
      cocokUntuk: ['Kitchen Set'],
    },
    {
      id: 'm2',
      nama: 'HPL Taco',
      kategori: 'finishing',
      ringkasan: 'Lapisan anti gores',
      cocokUntuk: ['Kabinet'],
    },
  ] as unknown as MaterialSpecItem[];

  assert.equal(filterAdminMaterials(materials, { search: '', category: 'all' }).length, 2);
  assert.equal(filterAdminMaterials(materials, { search: '', category: 'finishing' })[0]?.id, 'm2');
  assert.equal(filterAdminMaterials(materials, { search: 'meranti', category: 'all' })[0]?.id, 'm1');
});

test('filterAdminFaqs filters by category, status, and query', () => {
  const faqs = [
    {
      id: 'f1',
      kategori: 'Pembayaran',
      pertanyaan: 'Bagaimana skema DP?',
      jawaban: 'Termin bertahap',
      urutan: 1,
      terbit: true,
    },
    {
      id: 'f2',
      kategori: 'Produksi',
      pertanyaan: 'Berapa lama pengerjaan?',
      jawaban: 'Sekitar 3 minggu',
      urutan: 2,
      terbit: false,
    },
  ] as unknown as FaqItem[];

  assert.equal(filterAdminFaqs(faqs, { search: '', category: 'Semua', status: 'all' }).length, 2);
  assert.equal(filterAdminFaqs(faqs, { search: '', category: 'Pembayaran', status: 'terbit' })[0]?.id, 'f1');
  assert.equal(filterAdminFaqs(faqs, { search: 'minggu', category: 'Semua', status: 'all' })[0]?.id, 'f2');
});

test('filterAdminUsers filters by search query across user info and active page access', () => {
  const users = [
    {
      id: 'u1',
      nama: 'Sandi Putra',
      email: 'sandi@shansusdzar.id',
      divisi: 'Workshop',
      isOwner: true,
      akses: [],
    },
    {
      id: 'u2',
      nama: 'Rina',
      email: 'rina@shansusdzar.id',
      divisi: 'Keuangan',
      isOwner: false,
      akses: [{ halaman: 'proyek', krendensial: 'view' }],
    },
  ] as unknown as AdminUserAccount[];

  assert.equal(filterAdminUsers(users, '').length, 2);
  assert.equal(filterAdminUsers(users, 'sandi')[0]?.id, 'u1');
  assert.equal(filterAdminUsers(users, 'keuangan')[0]?.id, 'u2');
  assert.equal(filterAdminUsers(users, 'proyek')[0]?.id, 'u2');
});
