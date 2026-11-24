import { Link } from 'react-router';
import { ProductCard } from '../../../components/ui/product-card';
import type { ProductItem } from '../../../types/product';

export function SectionRelatedProducts({ relatedProducts }: { relatedProducts: ProductItem[] }) {
  if (relatedProducts.length === 0) return null;

  return (
    <section
      aria-labelledby="related-products-heading"
      className="pt-8 border-t border-[var(--border)] space-y-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="related-products-heading" className="text-lg font-semibold text-[var(--text)]">
          Produk Terkait
        </h2>
        <Link
          to="/produk"
          className="text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text)] hover:underline whitespace-nowrap"
        >
          Semua Produk →
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 lg:gap-6">
        {relatedProducts.map((item) => (
          <ProductCard key={item.id} product={item} />
        ))}
      </div>
    </section>
  );
}
