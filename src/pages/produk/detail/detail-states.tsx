import { ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react';
import { Button, LinkButton } from '../../../components/ui/button';

export function ProductDetailLoadingState() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Memuat detail produk">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        <div className="lg:col-span-7 aspect-[4/3] rounded-[var(--radius-lg)] bg-[var(--surface-muted)] border border-[var(--border)]" />
        <div className="lg:col-span-5 space-y-4">
          <div className="h-4 w-32 rounded bg-[var(--surface-muted)]" />
          <div className="h-9 w-3/4 rounded bg-[var(--surface-muted)]" />
          <div className="h-20 w-full rounded bg-[var(--surface-muted)]" />
          <div className="h-12 w-full rounded bg-[var(--surface-muted)]" />
        </div>
      </div>
    </div>
  );
}

export function ProductDetailErrorState({
  errorMessage,
  onRetry,
}: {
  errorMessage: string | null;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="max-w-xl mx-auto my-8 p-6 border border-[var(--danger-border)] bg-[var(--danger-surface)] rounded-[var(--radius-md)] space-y-4"
    >
      <div className="space-y-1">
        <h1 className="text-base font-semibold text-[var(--danger)]">
          Data Produk Tidak Dapat Dimuat
        </h1>
        <p className="text-xs text-[var(--text-muted)]">
          {errorMessage || 'Terjadi kendala memuat data produk. Silakan coba muat ulang.'}
        </p>
      </div>
      <div className="flex flex-wrap gap-2.5">
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RotateCcw className="size-3.5" aria-hidden="true" />
          Coba Lagi
        </Button>
        <LinkButton to="/produk" variant="ghost" size="sm">
          Kembali ke Produk
        </LinkButton>
      </div>
    </div>
  );
}

export function ProductDetailNotFoundState() {
  return (
    <div className="max-w-2xl mx-auto py-12 text-center space-y-5">
      <p className="text-xs uppercase tracking-[0.08em] text-[var(--text-muted)]">
        Produk Furniture
      </p>
      <h1 className="text-2xl sm:text-3xl font-semibold text-[var(--text)]">
        Produk Tidak Ditemukan
      </h1>
      <p className="text-sm text-[var(--text-muted)] leading-relaxed">
        Unit produk yang Anda cari mungkin telah diperbarui alamatnya atau Anda dapat merancang
        kebutuhan ruangan secara langsung di kalkulator Custom Interior.
      </p>
      <div className="pt-2 flex flex-wrap justify-center gap-3">
        <LinkButton to="/produk" variant="primary" size="md">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Kembali ke Produk
        </LinkButton>
        <LinkButton to="/produk/custom" variant="secondary" size="md">
          Buka Custom Interior
          <ArrowRight className="size-4" aria-hidden="true" />
        </LinkButton>
      </div>
    </div>
  );
}
