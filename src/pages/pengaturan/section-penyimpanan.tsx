import { useCallback, useEffect, useState } from 'react';
import { Database, RotateCcw, ShoppingBag, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import {
  clearMediaCacheStorage,
  getMediaCacheStats,
  type MediaCacheStats,
} from '../../lib/media-cache';
import { formatStorageBytes } from '../../lib/settings-tabs';
import { useCartStore } from '../../store/cart-store';
import {
  clearPersistedOrderForm,
  loadPersistedOrderForm,
} from '../../store/order-form-cache';
import { SettingsSection } from './components';

interface SectionPenyimpananProps {
  onResetAll: () => void;
  resetNotice?: string | null;
  hideSectionHeader?: boolean;
}

function checkHasOrderDraft(): boolean {
  const { values, coordinates } = loadPersistedOrderForm();
  return Boolean(
    values.fullName.trim() ||
      values.phone.trim() ||
      values.address.trim() ||
      values.notes.trim() ||
      coordinates
  );
}

export function SectionPenyimpanan({
  onResetAll,
  resetNotice,
  hideSectionHeader = false,
}: SectionPenyimpananProps) {
  const cartItems = useCartStore((state) => state.items);
  const clearCart = useCartStore((state) => state.clearCart);
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  const [cacheStats, setCacheStats] = useState<MediaCacheStats>({
    cachedEntries: 0,
    storageUsedBytes: null,
  });
  const [hasOrderDraft, setHasOrderDraft] = useState<boolean>(() => checkHasOrderDraft());
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [storageNotice, setStorageNotice] = useState<string | null>(null);

  const refreshStats = useCallback(async () => {
    const nextStats = await getMediaCacheStats();
    setCacheStats(nextStats);
    setHasOrderDraft(checkHasOrderDraft());
  }, []);

  useEffect(() => {
    void refreshStats();
  }, [refreshStats]);

  const handleClearMediaCache = async () => {
    setIsClearingCache(true);
    try {
      await clearMediaCacheStorage();
      await refreshStats();
      setStorageNotice('Cache media dibersihkan.');
    } finally {
      setIsClearingCache(false);
    }
  };

  const handleClearTemporaryData = () => {
    clearCart();
    clearPersistedOrderForm();
    setHasOrderDraft(false);
    void refreshStats();
    setStorageNotice('Keranjang dan draf pesanan dihapus.');
  };

  const formattedStorageSize = formatStorageBytes(cacheStats.storageUsedBytes);
  const cacheSummaryText = [
    `${cacheStats.cachedEntries} aset tersimpan`,
    formattedStorageSize ? `Ukuran: ${formattedStorageSize}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const draftSummaryText = [
    `${cartCount} item di keranjang`,
    hasOrderDraft ? 'Ada draf formulir' : 'Tanpa draf',
  ].join(' · ');

  const hasTemporaryData = cartCount > 0 || hasOrderDraft;

  return (
    <SettingsSection
      id="penyimpanan"
      title="Penyimpanan"
      hideHeader={hideSectionHeader}
    >
      <div className="space-y-3">
        {(storageNotice || resetNotice) && (
          <div
            role="status"
            aria-live="polite"
            data-testid="pengaturan-storage-notice"
            className="p-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] text-xs text-[var(--text)]"
          >
            {storageNotice ?? resetNotice}
          </div>
        )}

        <div className="divide-y divide-[var(--border)]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-3.5">
            <div className="flex items-start gap-3 min-w-0">
              <Database
                className="size-4 text-[var(--text-muted)] shrink-0 mt-1"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--text)] leading-snug">
                  Cache Media
                </p>
                <p className="mt-0.5 text-xs text-[var(--text-muted)] leading-relaxed tabular-nums">
                  {cacheSummaryText}
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={isClearingCache}
              data-testid="penyimpanan-clear-cache-button"
              onClick={() => void handleClearMediaCache()}
              className="w-full sm:w-auto gap-1.5 shrink-0"
            >
              <Trash2 className="size-3.5 shrink-0" aria-hidden="true" />
              <span>{isClearingCache ? 'Membersihkan...' : 'Bersihkan'}</span>
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-3.5">
            <div className="flex items-start gap-3 min-w-0">
              <ShoppingBag
                className="size-4 text-[var(--text-muted)] shrink-0 mt-1"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--text)] leading-snug">
                  Keranjang &amp; Draf
                </p>
                <p className="mt-0.5 text-xs text-[var(--text-muted)] leading-relaxed tabular-nums">
                  {draftSummaryText}
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!hasTemporaryData}
              data-testid="penyimpanan-clear-temp-button"
              onClick={handleClearTemporaryData}
              className="w-full sm:w-auto gap-1.5 shrink-0"
            >
              <Trash2 className="size-3.5 shrink-0" aria-hidden="true" />
              <span>Hapus Data</span>
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 py-3.5">
            <div className="flex items-start gap-3 min-w-0">
              <RotateCcw
                className="size-4 text-[var(--text-muted)] shrink-0 mt-1"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--text)] leading-snug">
                  Reset Pengaturan
                </p>
                <p className="mt-0.5 text-xs text-[var(--text-muted)] leading-relaxed">
                  Kembalikan semua preferensi ke setelan awal.
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              data-testid="penyimpanan-reset-all-button"
              onClick={() => {
                setStorageNotice(null);
                onResetAll();
              }}
              className="w-full sm:w-auto gap-1.5 shrink-0"
            >
              <RotateCcw className="size-3.5 shrink-0" aria-hidden="true" />
              <span>Reset Bawaan</span>
            </Button>
          </div>
        </div>
      </div>
    </SettingsSection>
  );
}
