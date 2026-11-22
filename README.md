# Interior & Furniture Shansusdzar Indonesia

Situs web digital showroom untuk **Interior & Furniture Shansusdzar Indonesia** (Purwakarta, Indonesia).

## Skrip Pengembangan

```bash
npm run dev        # Menjalankan server pengembangan Vite pada port 3000
npm run build      # Membangun bundel produksi ke dist/
npm run preview    # Pratinjau hasil build produksi secara lokal
npm run typecheck  # Pemeriksaan tipe TypeScript (tsc --noEmit)
npm run lint       # Alias pemeriksaan tipe TypeScript
```

Untuk menjalankan pengujian unit logika murni:

```bash
npx --yes tsx --test src/lib/product-catalog.test.ts
```

## Struktur Direktori

```text
src/
  app/          # Root App, Providers, dan konfigurasi React Router
  components/   # Komponen UI bersama & AppShell
  hooks/        # Custom React hooks
  lib/          # Konfigurasi bisnis terpusat & loader/validator katalog
  pages/        # Halaman per rute: beranda, katalog, tentang, keranjang, not-found
  store/        # State management (tahap lanjutan)
  styles/       # Token gaya & tema (tahap lanjutan)
  types/        # Definisi tipe TypeScript (bisnis, produk)
public/
  produk/
    produk.json # Data katalog produk kanonik (saat ini berisi entri demo)
    gambar/     # Aset foto produk lokal
  images/       # Aset visual editorial lokal & slot placeholder
```

## Catatan Penting

- **Fakta bisnis terpusat** berada di `src/lib/business-config.ts`.
- **Direct URL refresh pada produksi:** Server pengembangan dan pratinjau Vite mendukung SPA fallback secara bawaan. Saat men-deploy hasil `dist/` ke static hosting, pastikan aturan rewrite diarahkan ke `index.html`.
- **Data demo:** `public/produk/produk.json` saat ini menggunakan contoh data dengan status harga `contact` (`null`) sampai harga dan foto produk resmi tersedia.
