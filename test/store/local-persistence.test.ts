import assert from 'node:assert/strict';
import test from 'node:test';
import {
  INDEXED_DB_STORE_NAME,
  flushIndexedDbWrites,
  resetLocalCacheMemoryForTest,
} from '../../src/lib/indexeddb-storage';
import { useAdminAuthStore } from '../../src/store/admin-auth-store';
import { useDocumentsStore } from '../../src/store/documents-store';
import { useFinanceStore } from '../../src/store/finance-store';
import { hydrateAllStoresFromIndexedDb } from '../../src/store/hydrate-stores';
import { useMarketingStore } from '../../src/store/marketing-store';
import { useProjectsStore } from '../../src/store/projects-store';
import { useSiteContentStore } from '../../src/store/site-content-store';

function createMemoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear() {
      map.clear();
    },
    getItem(key: string) {
      return map.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(map.keys())[index] ?? null;
    },
    removeItem(key: string) {
      map.delete(key);
    },
    setItem(key: string, value: string) {
      map.set(key, value);
    },
  };
}

function createFakeIndexedDb() {
  const storeData = new Map<string, { key: string; raw: string; updatedAt: number }>();

  const fakeStore = (tx: { oncomplete?: (() => void) | null }) => ({
    getAll() {
      const req: { result?: unknown; onsuccess?: (() => void) | null; onerror?: (() => void) | null } = {};
      queueMicrotask(() => {
        req.result = Array.from(storeData.values());
        req.onsuccess?.();
        tx.oncomplete?.();
      });
      return req;
    },
    put(val: { key: string; raw: string; updatedAt: number }) {
      storeData.set(val.key, { ...val });
    },
    delete(key: string) {
      storeData.delete(key);
    },
    clear() {
      storeData.clear();
    },
  });

  const fakeDb = {
    objectStoreNames: {
      contains: (name: string) => name === INDEXED_DB_STORE_NAME,
    },
    createObjectStore: () => ({}),
    close: () => {},
    transaction: (_name: string, mode: 'readonly' | 'readwrite') => {
      const tx: {
        oncomplete?: (() => void) | null;
        onerror?: (() => void) | null;
        onabort?: (() => void) | null;
        objectStore: (storeName: string) => ReturnType<typeof fakeStore>;
      } = {
        objectStore: () => fakeStore(tx),
      };
      if (mode === 'readwrite') {
        queueMicrotask(() => {
          tx.oncomplete?.();
        });
      }
      return tx;
    },
  };

  const factory = {
    open: () => {
      const req: {
        result?: unknown;
        onupgradeneeded?: (() => void) | null;
        onsuccess?: (() => void) | null;
        onerror?: (() => void) | null;
        onblocked?: (() => void) | null;
      } = {};
      queueMicrotask(() => {
        req.result = fakeDb;
        req.onsuccess?.();
      });
      return req;
    },
  };

  return { factory: factory as unknown as IDBFactory, storeData };
}

function setupMockWindow() {
  const idb = createFakeIndexedDb();
  const ls = createMemoryStorage();
  const g = globalThis as unknown as {
    window?: Record<string, unknown>;
    indexedDB?: IDBFactory;
  };
  const prevWindow = g.window;
  const prevIdb = g.indexedDB;

  g.window = {
    localStorage: ls,
    sessionStorage: createMemoryStorage(),
    indexedDB: idb.factory,
    addEventListener: () => {},
    removeEventListener: () => {},
  };
  g.indexedDB = idb.factory;

  return {
    idb,
    ls,
    restore() {
      resetLocalCacheMemoryForTest();
      if (prevWindow === undefined) {
        delete g.window;
      } else {
        g.window = prevWindow;
      }
      if (prevIdb === undefined) {
        delete g.indexedDB;
      } else {
        g.indexedDB = prevIdb;
      }
    },
  };
}

test('deleting ALL static template records across all admin stores persists empty arrays across IndexedDB reloads', async () => {
  const env = setupMockWindow();

  try {
    resetLocalCacheMemoryForTest();
    useSiteContentStore.getState().resetAllSiteContent();
    useMarketingStore.getState().resetMarketingDefaults();
    useProjectsStore.getState().resetProjectsDefaults();
    useFinanceStore.getState().resetFinanceDefaults();
    useDocumentsStore.getState().resetDocumentsDefaults();
    useAdminAuthStore.getState().resetAccessDefaults();

    // 1. Delete every template item in SiteContentStore
    const site = useSiteContentStore.getState();
    for (const p of [...site.portfolioProjects]) {
      site.deletePortfolioProject(p.id);
    }
    for (const n of [...site.newsArticles]) {
      site.deleteNewsArticle(n.id);
    }
    for (const m of [...site.materials]) {
      site.deleteMaterial(m.id);
    }
    for (const f of [...site.faqs]) {
      site.deleteFaq(f.id);
    }
    for (const s of [...(site.socialPlans ?? [])]) {
      site.deleteSocialPlan(s.id);
    }
    site.updateTentang({
      ...site.tentang,
      anggotaTim: [],
      sorotanWorkshop: [],
    });
    const activeCatalog = site.getActiveCatalog();
    assert.ok(activeCatalog && activeCatalog.daftarProduk.length > 0);
    for (const prod of [...activeCatalog.daftarProduk]) {
      await site.deleteCatalogProduct(prod.id);
    }

    // 2. Delete every template item in MarketingStore
    const mkt = useMarketingStore.getState();
    for (const c of [...mkt.contacts]) mkt.deleteContact(c.id);
    for (const item of [...mkt.campaignItems]) mkt.deleteCampaignItem(item.id);
    for (const log of [...mkt.campaigns]) mkt.deleteCampaignLog(log.id);

    // 3. Delete every template item in ProjectsStore
    const proj = useProjectsStore.getState();
    for (const p of [...proj.projects]) proj.deleteProject(p.id);

    // 4. Delete every template item in FinanceStore
    const fin = useFinanceStore.getState();
    for (const tx of [...fin.transactions]) fin.deleteTransaction(tx.id);
    for (const inv of [...fin.invoices]) fin.deleteProjectInvoice(inv.id);

    // 5. Delete every template item in DocumentsStore
    const doc = useDocumentsStore.getState();
    for (const q of [...doc.quotations]) doc.deleteQuotation(q.id);
    for (const w of [...doc.workOrders]) doc.deleteWorkOrder(w.id);
    for (const d of [...doc.deliveryOrders]) doc.deleteDeliveryOrder(d.id);
    for (const a of [...doc.agreements]) doc.deleteAgreement(a.id);
    for (const h of [...doc.handoverCertificates]) doc.deleteHandoverCertificate(h.id);

    await flushIndexedDbWrites();

    // Simulate closing app, wiping memory AND localStorage, leaving only IndexedDB
    resetLocalCacheMemoryForTest();
    env.ls.clear();

    await hydrateAllStoresFromIndexedDb({ timeoutMs: 0 });

    const reloadedSite = useSiteContentStore.getState();
    assert.equal(reloadedSite.portfolioProjects.length, 0);
    assert.equal(reloadedSite.newsArticles.length, 0);
    assert.equal(reloadedSite.materials.length, 0);
    assert.equal(reloadedSite.faqs.length, 0);
    assert.equal(reloadedSite.socialPlans?.length ?? 0, 0);
    assert.equal(reloadedSite.tentang.anggotaTim.length, 0);
    assert.equal(reloadedSite.tentang.sorotanWorkshop.length, 0);
    assert.equal(reloadedSite.getActiveCatalog()?.daftarProduk.length, 0);

    const reloadedMkt = useMarketingStore.getState();
    assert.equal(reloadedMkt.contacts.length, 0);
    assert.equal(reloadedMkt.campaignItems.length, 0);
    assert.equal(reloadedMkt.campaigns.length, 0);

    assert.equal(useProjectsStore.getState().projects.length, 0);
    assert.equal(useFinanceStore.getState().transactions.length, 0);
    assert.equal(useFinanceStore.getState().invoices.length, 0);

    const reloadedDocs = useDocumentsStore.getState();
    assert.equal(reloadedDocs.quotations.length, 0);
    assert.equal(reloadedDocs.workOrders.length, 0);
    assert.equal(reloadedDocs.deliveryOrders.length, 0);
    assert.equal(reloadedDocs.agreements.length, 0);
    assert.equal(reloadedDocs.handoverCertificates.length, 0);
  } finally {
    env.restore();
  }
});

test('edits and uploaded data URL images persist in IndexedDB across reloads even without localStorage', async () => {
  const env = setupMockWindow();

  try {
    resetLocalCacheMemoryForTest();
    useSiteContentStore.getState().resetAllSiteContent();

    const site = useSiteContentStore.getState();
    site.updateBusinessConfig({
      ...site.businessConfig,
      drafSlogan: 'Slogan Baru Tersimpan di IndexedDB',
    });

    const firstPortfolio = site.portfolioProjects[0];
    assert.ok(firstPortfolio);
    site.upsertPortfolioProject({
      ...firstPortfolio,
      gambarUtama: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk',
      galeriGambar: ['data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk'],
    });

    await flushIndexedDbWrites();

    // Clear memory + localStorage to force pure IndexedDB reload
    resetLocalCacheMemoryForTest();
    env.ls.clear();
    await hydrateAllStoresFromIndexedDb({ timeoutMs: 0 });

    const reloaded = useSiteContentStore.getState();
    assert.equal(reloaded.businessConfig.drafSlogan, 'Slogan Baru Tersimpan di IndexedDB');
    assert.ok(reloaded.portfolioProjects[0].gambarUtama.startsWith('data:image/png;base64,'));
  } finally {
    env.restore();
  }
});
