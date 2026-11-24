import {
  extractBudgetFromText,
  isFuzzyWordMatch,
  normalizeChatText,
  stemIndonesianWord,
} from './fuzzy-matcher';
import type {
  ExtractedDimensionQuery,
  ParsedUserQuery,
  SainAiDesignStyle,
  SainAiGreetingVariant,
  SainAiIntent,
} from './types';

const SYNONYM_MAP: Record<string, string[]> = {
  kitchen: ['dapur', 'kabinet', 'sink', 'wastafel', 'kompor', 'cooker'],
  dapur: ['kitchen', 'kitchen-set', 'island', 'kabinet', 'masak', 'pantry'],
  pantry: ['kitchen', 'dapur', 'island', 'kabinet'],
  kabinet: ['lemari', 'kitchen', 'credenza', 'rak'],
  lemari: ['wardrobe', 'pakaian', 'baju', 'rak', 'kabinet', 'sepatu'],
  wardrobe: ['lemari', 'pakaian', 'baju', 'gantungan', 'sliding'],
  tv: ['backdrop', 'televisi', 'keluarga', 'meja-tv', 'credenza'],
  backdrop: ['tv', 'wall-panel', 'dinding', 'headboard', 'kisi'],
  partisi: ['sekat', 'pembatas', 'ruangan', 'penyekat'],
  sekat: ['partisi', 'pembatas', 'ruangan', 'penyekat'],
  penyekat: ['partisi', 'sekat', 'pembatas', 'ruangan'],
  meja: ['kerja', 'rias', 'makan', 'island', 'nakas', 'kasir', 'resepsionis', 'belajar'],
  divan: ['ranjang', 'tempat', 'tidur', 'kasur', 'headboard', 'kamar'],
  headboard: ['sandaran', 'kasur', 'divan', 'dinding', 'kamar'],
  nakas: ['bedside', 'meja', 'samping', 'kasur', 'kamar'],
  rias: ['dandan', 'makeup', 'cermin', 'meja', 'kamar'],
  kerja: ['belajar', 'kantor', 'wfh', 'komputer', 'meja'],
  sepatu: ['rak', 'lemari', 'sandal', 'lorong'],
  tangga: ['bawah', 'kabinet', 'gudang', 'penyimpanan'],
  laundry: ['cuci', 'mesin', 'jemur', 'servis'],
  vanity: ['wastafel', 'kamar-mandi', 'cermin', 'toilet', 'basah'],
  kasir: ['toko', 'kafe', 'gerai', 'komersial', 'booth'],
  resepsionis: ['kantor', 'lobby', 'klinik', 'lobi', 'komersial'],
  booth: ['pameran', 'gerai', 'kafe', 'tenant', 'stand', 'komersial'],
  harga: ['biaya', 'tarif', 'budget', 'anggaran', 'estimasi', 'nominal', 'berapa'],
  biaya: ['harga', 'tarif', 'estimasi', 'dp', 'termin', 'ongkir'],
  estimasi: ['hitung', 'kalkulasi', 'harga', 'biaya', 'ukuran', 'perkiraan', 'rab'],
  hitung: ['estimasi', 'harga', 'ukuran', 'kalkulator'],
  budget: ['anggaran', 'dana', 'biaya', 'cukup', 'maksimal', 'modal'],
  anggaran: ['budget', 'dana', 'biaya', 'cukup'],
  dp: ['termin', 'pembayaran', 'uang', 'muka', 'bayar', 'cicil', 'tahap'],
  termin: ['pembayaran', 'dp', 'tahap', 'bast', 'instalasi', 'progress', 'transfer'],
  bayar: ['pembayaran', 'termin', 'dp', 'rekening', 'invoice', 'transfer'],
  desain: ['design', '3d', 'gambar', 'gratis', 'tata', 'letak', 'revisi'],
  design: ['desain', '3d', 'gratis'],
  survei: ['ukur', 'pengukuran', 'kunjungan', 'jangkauan', 'datang', 'lokasi'],
  wilayah: ['jangkauan', 'daerah', 'kota', 'cakupan', 'area', 'kecamatan'],
  jam: ['buka', 'tutup', 'operasional', 'jadwal', 'waktu', 'senin', 'sabtu'],
  alamat: ['lokasi', 'workshop', 'bengkel', 'kantor', 'peta', 'maps', 'cibogohilir', 'purwakarta'],
  kontak: ['whatsapp', 'telepon', 'chat', 'hubungi', 'admin', 'nomor'],
  whatsapp: ['kontak', 'hubungi', 'chat', 'admin', 'nomor'],
  multipleks: ['papan', 'kayu', 'tebal', '18mm', 'kuat', 'plywood', 'triplek'],
  blockboard: ['blokboard', 'papan', 'ringan', 'ekonomis', '18mm'],
  pvc: ['anti-air', 'anti-rayap', 'basah', 'lembap', 'rayap', 'sink', 'kamar-mandi', 'vanity'],
  lembap: ['basah', 'pvc', 'sink', 'dapur', 'kamar-mandi', 'anti-air'],
  air: ['basah', 'lembap', 'pvc', 'rayap', 'anti-air'],
  hpl: ['laminasi', 'pelapis', 'finishing', 'taco', 'motif'],
  duco: ['cat', 'semprot', 'finishing', 'warna', 'profil', 'klasik'],
  warna: ['palet', 'cat', 'motif', 'nuansa', 'walnut', 'gading', 'grafit', 'zaitun'],
  garansi: ['perbaikan', 'revisi', 'hardware', 'engsel', 'purna', 'jual', 'bast', 'bulan'],
  lama: ['durasi', 'hari', 'kerja', 'pengerjaan', 'waktu', 'kapan', 'selesai', 'produksi'],
  proses: ['alur', 'tahap', 'tahapan', 'cara', 'pesan', 'order', 'langkah'],
  pesan: ['order', 'proses', 'alur', 'custom', 'beli'],
  portofolio: ['proyek', 'hasil', 'contoh', 'klien', 'ulasan', 'testimoni', 'review'],
  ulasan: ['testimoni', 'review', 'klien', 'portofolio'],
  tips: ['artikel', 'panduan', 'berita', 'info', 'perawatan', 'rawat'],
  berita: ['artikel', 'kabar', 'workshop', 'tips', 'proyek'],
  tim: ['pemilik', 'owner', 'hilman', 'santri', 'pengrajin', 'tentang', 'studio', 'siapa'],
  promo: ['diskon', 'potongan', 'hemat', 'penawaran'],
  ongkir: ['kirim', 'antar', 'instalasi', 'pasang', 'gratis'],
  pasang: ['instalasi', 'rakit', 'ongkir', 'survei'],
};

const COVERED_CITIES: Array<{ keywords: string[]; label: string }> = [
  {
    keywords: [
      'purwakarta',
      'cibogohilir',
      'kota bukit indah',
      'jatiluhur',
      'plered',
      'campaka',
      'bungursari',
      'babakancikao',
      'wanayasa',
      'cibatu',
      'darangdan',
      'sukatani',
    ],
    label: 'Kabupaten Purwakarta',
  },
  {
    keywords: [
      'karawang',
      'cikampek',
      'klari',
      'kosambi',
      'telukjambe',
      'galuh mas',
      'cilamaya',
      'rengasdengklok',
      'kotabaru',
    ],
    label: 'Karawang & Cikampek',
  },
  {
    keywords: ['subang', 'kalijati', 'pagaden', 'pamanukan', 'ciater', 'jalancagak'],
    label: 'Subang',
  },
  {
    keywords: [
      'bandung',
      'cimahi',
      'lembang',
      'bandung raya',
      'padalarang',
      'soreang',
      'cibiru',
      'dago',
      'antapani',
      'buah batu',
      'cileunyi',
      'setiabudi',
    ],
    label: 'Bandung Raya',
  },
  {
    keywords: [
      'bekasi',
      'cikarang',
      'tambun',
      'cibitung',
      'lippo cikarang',
      'deltamas',
      'jababeka',
      'meikarta',
      'grand wisata',
      'babelan',
    ],
    label: 'Bekasi & Cikarang',
  },
];

const UNCOVERED_CITIES: Array<{ keyword: string; label: string }> = [
  { keyword: 'bogor', label: 'Bogor' },
  { keyword: 'depok', label: 'Depok' },
  { keyword: 'tangerang', label: 'Tangerang' },
  { keyword: 'bsd', label: 'Tangerang (BSD)' },
  { keyword: 'bintaro', label: 'Tangerang Selatan' },
  { keyword: 'jakarta', label: 'Jakarta' },
  { keyword: 'serang', label: 'Serang' },
  { keyword: 'cilegon', label: 'Cilegon' },
  { keyword: 'cirebon', label: 'Cirebon' },
  { keyword: 'indramayu', label: 'Indramayu' },
  { keyword: 'sumedang', label: 'Sumedang' },
  { keyword: 'garut', label: 'Garut' },
  { keyword: 'tasikmalaya', label: 'Tasikmalaya' },
  { keyword: 'tasik', label: 'Tasikmalaya' },
  { keyword: 'majalengka', label: 'Majalengka' },
  { keyword: 'cianjur', label: 'Cianjur' },
  { keyword: 'sukabumi', label: 'Sukabumi' },
  { keyword: 'semarang', label: 'Semarang' },
  { keyword: 'yogyakarta', label: 'Yogyakarta' },
  { keyword: 'jogja', label: 'Yogyakarta' },
  { keyword: 'solo', label: 'Solo' },
  { keyword: 'surabaya', label: 'Surabaya' },
  { keyword: 'malang', label: 'Malang' },
  { keyword: 'bali', label: 'Bali' },
  { keyword: 'medan', label: 'Medan' },
  { keyword: 'palembang', label: 'Palembang' },
  { keyword: 'makassar', label: 'Makassar' },
  { keyword: 'lampung', label: 'Lampung' },
  { keyword: 'balikpapan', label: 'Balikpapan' },
];

const GREETING_PATTERNS = [
  /^(halo|hai|hi|hey|selamat\s+(pagi|siang|sore|malam)|pagi|siang|sore|malam|assalamualaikum|permisi|punten|p|tes|test)(?:\s+(admin|sain|semuanya))?$/i,
  /\bsiapa\s+(kamu|anda|sain(\s*ai)?|sahabat\s*interior)\b/i,
  /\b(sain(\s*ai)?|sahabat\s*interior)\b.*\b(apa|siapa|bisa|kepanjangan|singkatan)\b/i,
  /\b(kamu|anda|sain)\s+(bisa|bantu)\s+apa\b/i,
];

const CLOSING_PATTERNS = [
  /^(terima kasih|oke|oke terima kasih|baik terima kasih|cukup|sudah jelas|jelas|siap terima kasih|oke siap)(?:\s+(sain|admin|ya|saja))?$/i,
  /\b(terima kasih|cukup membantu|sudah jelas banget|info sangat membantu)\b/i,
];

const KEYWORD_NOISE_WORDS = new Set([
  'yang',
  'untuk',
  'dengan',
  'dari',
  'pada',
  'dalam',
  'atau',
  'dan',
  'ini',
  'itu',
  'ada',
  'bisa',
  'tidak',
  'bukan',
  'saja',
  'juga',
  'akan',
  'sudah',
  'belum',
  'kalau',
  'apakah',
  'bagaimana',
  'gimana',
  'tolong',
  'saya',
  'kami',
  'anda',
  'mau',
  'butuh',
  'lagi',
  'dong',
  'nih',
  'sih',
  'ya',
  'deh',
  'kan',
  'banget',
  'sekalian',
  'admin',
]);

export function normalizeIndonesianQuery(raw: string): string {
  return normalizeChatText(raw);
}

export function tokenizeIndonesianQuery(normalized: string): string[] {
  if (!normalized) return [];
  return normalized
    .split(/[\s,/]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 || /^\d+$/.test(token));
}

export function expandIndonesianTokens(tokens: readonly string[]): string[] {
  const expanded = new Set<string>(tokens);
  for (const token of tokens) {
    const stemmed = stemIndonesianWord(token);
    if (stemmed.length >= 3) {
      expanded.add(stemmed);
    }
    for (const candidate of [token, stemmed]) {
      const related = SYNONYM_MAP[candidate];
      if (related) {
        for (const word of related) {
          expanded.add(word);
        }
      }
    }
  }
  return Array.from(expanded);
}

function extractImportantKeywords(
  tokens: readonly string[],
  stemmedTokens: readonly string[]
): string[] {
  const result = new Set<string>();
  tokens.forEach((tok, idx) => {
    const cleaned = tok.replace(/^[.,-]+|[.,-]+$/g, '');
    if (!cleaned || cleaned.length < 2 || KEYWORD_NOISE_WORDS.has(cleaned)) return;
    result.add(cleaned);
    const stem = stemmedTokens[idx];
    if (stem && stem.length >= 3 && !KEYWORD_NOISE_WORDS.has(stem)) {
      result.add(stem);
    }
  });
  return Array.from(result);
}

export function detectMaterialFromText(
  normalized: string
): 'blockboard' | 'multipleks' | 'pvc' | null {
  if (/\bpvc\b|anti-air|anti-rayap|kamar\s*mandi|vanity|area\s*basah|sink/.test(normalized)) {
    return 'pvc';
  }
  if (/\bmultiplek|\bplywood|\btriplek/.test(normalized)) {
    return 'multipleks';
  }
  if (/\bblock\s*board|\bblockboard|\bblokboard/.test(normalized)) {
    return 'blockboard';
  }
  return null;
}

export function detectFinishFromText(normalized: string): 'hpl' | 'cat-duco' | null {
  if (/\bduco\b|\bcat\s+duco\b|\bcat\s+semprot\b/.test(normalized)) {
    return 'cat-duco';
  }
  if (/\bhpl\b|\blaminasi\b|\btaco\b/.test(normalized)) {
    return 'hpl';
  }
  return null;
}

function detectCityCoverage(normalized: string): ParsedUserQuery['detectedCity'] {
  for (const entry of COVERED_CITIES) {
    const matchedName = entry.keywords.find((kw) => matchesKeywordWithBoundaries(normalized, kw));
    if (matchedName) {
      return {
        name: matchedName
          .split(' ')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' '),
        isCovered: true,
        matchedRegionLabel: entry.label,
      };
    }
  }

  for (const entry of UNCOVERED_CITIES) {
    if (matchesKeywordWithBoundaries(normalized, entry.keyword)) {
      return {
        name: entry.label,
        isCovered: false,
      };
    }
  }

  return null;
}

function detectRoomFromText(normalized: string): string | null {
  if (/\b(dapur|pantry|masak|kompor|sink)\b/.test(normalized)) return 'Dapur & Bar';
  if (/\b(kamar tidur|tidur|ranjang|kasur|baju|pakaian|wardrobe)\b/.test(normalized)) {
    return 'Kamar Tidur';
  }
  if (/\b(ruang tamu|ruang keluarga|keluarga|nonton|tv|televisi)\b/.test(normalized)) {
    return 'Ruang Keluarga & Dinding';
  }
  if (/\b(kantor|kerja|wfh|belajar|komputer|tangga|sepatu)\b/.test(normalized)) {
    return 'Ruang Kerja & Penyimpanan';
  }
  if (/\b(kamar mandi|vanity|wastafel|cuci|laundry|mesin cuci)\b/.test(normalized)) {
    return 'Kamar Mandi & Cuci';
  }
  if (/\b(toko|kafe|cafe|warung|gerai|booth|kasir|resepsionis|lobi|lobby|klinik|stand|pameran)\b/.test(normalized)) {
    return 'Komersial & Gerai';
  }
  return null;
}

function detectDesignStyle(normalized: string): SainAiDesignStyle | null {
  if (/\b(klasik|classic|american|ukir|profil|moulding|molding)\b/.test(normalized)) return 'klasik';
  if (/\b(japandi|skandinavia|scandinavian|hangat|natural)\b/.test(normalized)) return 'japandi';
  if (/\b(industrial|besi|hitam|gelap|maskulin)\b/.test(normalized)) return 'industrial';
  if (/\b(minimalis|modern|simple|simpel|bersih|rapi|rata)\b/.test(normalized)) return 'minimalis';
  return null;
}

function detectHardwareOrShape(normalized: string): string[] {
  const tags: string[] = [];
  if (/\bl-shape\b/.test(normalized)) tags.push('Bentuk L (L-Shape)');
  if (/\bu-shape\b/.test(normalized)) tags.push('Bentuk U (U-Shape)');
  if (/\bsliding\b/.test(normalized)) tags.push('Pintu Geser (Sliding)');
  if (/\bswing\b/.test(normalized)) tags.push('Pintu Ayun (Swing)');
  if (/\bfloating|gantung\b/.test(normalized)) tags.push('Model Gantung (Floating)');
  if (/\bsoft-close\b/.test(normalized)) tags.push('Engsel & Rel Soft-Close');
  if (/\b(led|lampu strip|ambient)\b/.test(normalized)) tags.push('Jalur Lampu LED');
  if (/\b(cermin|kaca)\b/.test(normalized)) tags.push('Panel Cermin / Kaca');
  return tags;
}

function detectGreetingVariant(normalized: string): SainAiGreetingVariant | null {
  if (!normalized) return 'casual';
  if (/\bassalamualaikum\b/.test(normalized)) return 'salam';
  if (/\bpagi\b/.test(normalized)) return 'pagi';
  if (/\bsiang\b/.test(normalized)) return 'siang';
  if (/\bsore\b/.test(normalized)) return 'sore';
  if (/\bmalam\b/.test(normalized)) return 'malam';
  if (/\b(bisa apa|bantu apa|siapa kamu|siapa anda|kepanjangan|singkatan)\b/.test(normalized)) {
    return 'capability';
  }
  if (GREETING_PATTERNS.some((pattern) => pattern.test(normalized))) return 'casual';
  return null;
}

function parseLocaleFloat(raw: string): number {
  return Number(raw.replace(',', '.'));
}

function toCentimeters(val: number, unit: string): number {
  const u = unit.toLowerCase();
  if (u === 'm' || u === 'meter') return Math.round(val * 100);
  if (u === 'cm') return Math.round(val);
  return Math.round(val <= 15 ? val * 100 : val);
}

export function extractDimensionsFromQuery(normalized: string): ExtractedDimensionQuery | null {
  // 1. Format dua sisi langsung: "250x220", "2.5m x 2.2m", "3x2 meter"
  const twoDimMatch = normalized.match(
    /(\d+(?:[.,]\d+)?)\s*(?:(meter|cm|m)\b)?\s*[x×*]\s*(\d+(?:[.,]\d+)?)\s*(?:(meter|cm|m)\b)?/i
  );
  if (twoDimMatch) {
    const v1 = parseLocaleFloat(twoDimMatch[1]);
    const v2 = parseLocaleFloat(twoDimMatch[3]);
    const unit1 = (twoDimMatch[2] ?? '').toLowerCase();
    const unit2 = (twoDimMatch[4] ?? '').toLowerCase();
    const explicitUnit = unit2 || unit1;
    if (Number.isFinite(v1) && Number.isFinite(v2) && v1 > 0 && v2 > 0) {
      const isMeters =
        explicitUnit === 'm' ||
        explicitUnit === 'meter' ||
        (v1 <= 15 && v2 <= 15 && !explicitUnit.includes('cm'));
      const lengthCm = Math.round(isMeters ? v1 * 100 : v1);
      const widthOrHeightCm = Math.round(isMeters ? v2 * 100 : v2);
      if (lengthCm >= 30 && widthOrHeightCm >= 30 && lengthCm <= 2000 && widthOrHeightCm <= 2000) {
        const areaSqm = Math.round(((lengthCm * widthOrHeightCm) / 10000) * 100) / 100;
        const lengthMeters = Math.round((lengthCm / 100) * 100) / 100;
        return {
          lengthCm,
          widthOrHeightCm,
          areaSqm,
          lengthMeters,
          rawLabel: `${lengthCm} × ${widthOrHeightCm} cm`,
        };
      }
    }
  }

  // 2. Format berlabel bahasa Indonesia: "panjang 3m tinggi 2,2m", "p 250 t 220", "lebar 200 tinggi 240"
  const lengthLabeled = normalized.match(
    /\b(?:panjang|pjg|p)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*(meter|cm|m)?\b/i
  );
  const heightOrWidthLabeled = normalized.match(
    /\b(?:tinggi|tng|t|lebar|lbr|l)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*(meter|cm|m)?\b/i
  );
  if (lengthLabeled && heightOrWidthLabeled) {
    const lengthCm = toCentimeters(
      parseLocaleFloat(lengthLabeled[1]),
      lengthLabeled[2] || heightOrWidthLabeled[2] || ''
    );
    const widthOrHeightCm = toCentimeters(
      parseLocaleFloat(heightOrWidthLabeled[1]),
      heightOrWidthLabeled[2] || lengthLabeled[2] || ''
    );
    if (lengthCm >= 30 && widthOrHeightCm >= 30 && lengthCm <= 2000 && widthOrHeightCm <= 2000) {
      const areaSqm = Math.round(((lengthCm * widthOrHeightCm) / 10000) * 100) / 100;
      const lengthMeters = Math.round((lengthCm / 100) * 100) / 100;
      return {
        lengthCm,
        widthOrHeightCm,
        areaSqm,
        lengthMeters,
        rawLabel: `${lengthCm} × ${widthOrHeightCm} cm`,
      };
    }
  }

  // 3. Format luas meter persegi: "6 m2", "6,5 meter persegi"
  const sqmMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:m2|m²|meter\s*persegi)\b/i);
  if (sqmMatch) {
    const areaSqm = parseLocaleFloat(sqmMatch[1]);
    if (Number.isFinite(areaSqm) && areaSqm > 0 && areaSqm <= 200) {
      return {
        areaSqm: Math.round(areaSqm * 100) / 100,
        rawLabel: `${areaSqm} m²`,
      };
    }
  }

  // 4. Format 1 dimensi meter: "3 meter", "2,5m", "panjang 3m"
  const oneDimMeterMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*(?:meter|m)(?:-lari)?\b/i);
  if (oneDimMeterMatch) {
    const meters = parseLocaleFloat(oneDimMeterMatch[1]);
    if (Number.isFinite(meters) && meters >= 0.4 && meters <= 30) {
      const lengthCm = Math.round(meters * 100);
      return {
        lengthCm,
        lengthMeters: Math.round(meters * 100) / 100,
        rawLabel: `${meters} m`,
      };
    }
  }

  // 5. Format 1 dimensi cm: "250 cm"
  const oneDimCmMatch = normalized.match(/(\d+(?:[.,]\d+)?)\s*cm\b/i);
  if (oneDimCmMatch) {
    const cm = Math.round(parseLocaleFloat(oneDimCmMatch[1]));
    if (Number.isFinite(cm) && cm >= 40 && cm <= 2000) {
      return {
        lengthCm: cm,
        lengthMeters: Math.round((cm / 100) * 100) / 100,
        rawLabel: `${cm} cm`,
      };
    }
  }

  return null;
}

interface IntentRule {
  intent: SainAiIntent;
  keywords: string[];
  weight: number;
}

const INTENT_RULES: IntentRule[] = [
  {
    intent: 'budget_planner',
    keywords: [
      'budget',
      'anggaran',
      'dana',
      'modal',
      'cukup untuk',
      'dapat apa',
      'nominal',
      'maksimal',
      'kisaran dana',
      'punya uang',
      'punya dana',
    ],
    weight: 4.5,
  },
  {
    intent: 'promo_katalog',
    keywords: ['promo', 'diskon', 'potongan', 'hemat', 'lagi promo', 'ada promo', 'penawaran'],
    weight: 4.1,
  },
  {
    intent: 'layanan_biaya',
    keywords: [
      'ongkir',
      'ongkos pasang',
      'biaya survei',
      'gratis survei',
      'gratis desain',
      'desain 3d',
      'termasuk pasang',
      'sudah termasuk',
      'bawa gambar',
      'referensi sendiri',
      'pinterest',
      'nego',
      'diskon banyak',
      'diskon paket',
    ],
    weight: 4.3,
  },
  {
    intent: 'pembayaran_termin',
    keywords: [
      'termin',
      'dp',
      'uang muka',
      'pembayaran',
      'bayar',
      'cicil',
      'rekening',
      'transfer',
      'invoice',
      'spks',
      'pelunasan',
    ],
    weight: 4.0,
  },
  {
    intent: 'survei_lokasi',
    keywords: [
      'survei',
      'pengukuran',
      'ukur',
      'jangkauan',
      'area survei',
      'area jangkauan',
      'cakupan area',
      'luar kota',
      'wilayah',
      'daerah',
      'purwakarta',
      'karawang',
      'cikampek',
      'subang',
      'bandung',
      'cimahi',
      'lembang',
      'bekasi',
      'cikarang',
      'tambun',
      'cibitung',
      'jakarta',
      'bogor',
      'depok',
      'tangerang',
      'cirebon',
      'garut',
      'tasikmalaya',
      'surabaya',
      'sampel bahan',
      'bawa sampel',
    ],
    weight: 3.7,
  },
  {
    intent: 'harga_estimasi',
    keywords: [
      'harga',
      'biaya',
      'tarif',
      'estimasi',
      'hitung',
      'berapa',
      'meter-lari',
      'per meter',
      'm2',
      'daftar harga',
      'mulai berapa',
      'paling murah',
    ],
    weight: 3.8,
  },
  {
    intent: 'material_finishing',
    keywords: [
      'bahan',
      'material',
      'ketebalan',
      '18 mm',
      '18mm',
      'blockboard',
      'multipleks',
      'pvc',
      'mdf',
      'particle-board',
      'hpl',
      'duco',
      'cat duco',
      'finishing',
      'laminasi',
      'lembap',
      'basah',
      'sink',
      'anti-air',
      'anti-rayap',
      'rayap',
      'lapuk',
      'perbedaan',
      'bedanya',
      'bandingkan',
      'kelebihan',
      'cocok untuk',
      'lebih awet',
      'lebih murah',
      'lebih bagus',
    ],
    weight: 3.6,
  },
  {
    intent: 'garansi_kebijakan',
    keywords: [
      'garansi',
      'jaminan',
      'purna jual',
      'perbaikan',
      'rusak',
      'revisi',
      'kebijakan',
      'syarat',
      'ketentuan',
      'privasi',
      'inspeksi',
      'bast',
      'klaim',
    ],
    weight: 3.6,
  },
  {
    intent: 'alur_kerja',
    keywords: [
      'alur',
      'tahap',
      'tahapan',
      'cara pesan',
      'cara order',
      'pemesanan',
      'proses',
      'langkah',
      'durasi',
      'berapa lama',
      'lama produksi',
      'hari kerja',
      'waktu produksi',
      'kapan selesai',
      'pengerjaan',
    ],
    weight: 3.6,
  },
  {
    intent: 'portofolio_ulasan',
    keywords: [
      'portofolio',
      'proyek',
      'hasil kerja',
      'testimoni',
      'ulasan',
      'review',
      'klien',
      'contoh proyek',
      'hasil jadi',
    ],
    weight: 3.6,
  },
  {
    intent: 'warna_palet',
    keywords: [
      'warna',
      'palet',
      'nuansa',
      'motif',
      'gading',
      'walnut',
      'zaitun',
      'grafit',
      'arang',
      'matte',
      'doff',
      'glossy',
    ],
    weight: 3.5,
  },
  {
    intent: 'tips_berita',
    keywords: ['tips', 'perawatan', 'merawat', 'rawat', 'bersihkan', 'berita', 'artikel', 'kabar'],
    weight: 3.5,
  },
  {
    intent: 'jadwal_kontak',
    keywords: [
      'jam buka',
      'jam operasional',
      'operasional',
      'buka',
      'tutup',
      'alamat',
      'workshop',
      'bengkel',
      'cibogohilir',
      'whatsapp',
      'kontak',
      'hubungi',
      'admin',
      'maps',
      'instagram',
      'tiktok',
      'nomor',
      'telepon',
    ],
    weight: 3.6,
  },
  {
    intent: 'tentang_tim',
    keywords: [
      'tentang',
      'profil',
      'studio',
      'tim',
      'pemilik',
      'owner',
      'hilman',
      'santri',
      'pengrajin',
      'visi',
      'misi',
    ],
    weight: 3.2,
  },
  {
    intent: 'produk_katalog',
    keywords: [
      'produk',
      'katalog',
      'rekomendasi',
      'kelengkapan',
      'include',
      'engsel',
      'soft-close',
      'rak piring',
      'kitchen',
      'dapur',
      'pantry',
      'lemari',
      'wardrobe',
      'backdrop',
      'partisi',
      'sekat',
      'penyekat',
      'credenza',
      'meja',
      'island',
      'nakas',
      'vanity',
      'divan',
      'headboard',
      'rak',
      'wall panel',
      'kisi',
      'resepsionis',
      'kasir',
      'laundry',
      'tangga',
      'booth',
      'custom',
      'kamar tidur',
      'ruang tamu',
      'ruang keluarga',
      'toko',
      'kafe',
      'komersial',
    ],
    weight: 2.8,
  },
];

function escapeRegexLiteral(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function matchesKeywordWithBoundaries(normalized: string, keyword: string): boolean {
  const pattern = new RegExp(
    `(?:^|[\\s.,*/-])${escapeRegexLiteral(keyword)}(?=$|[\\s.,*/-])`,
    'i'
  );
  return pattern.test(normalized);
}

export function classifyUserQuery(raw: string): ParsedUserQuery {
  const normalized = normalizeIndonesianQuery(raw);
  const tokens = tokenizeIndonesianQuery(normalized);
  const stemmedTokens = tokens.map(stemIndonesianWord);
  const expandedTokens = expandIndonesianTokens(tokens);
  const extractedKeywords = extractImportantKeywords(tokens, stemmedTokens);

  const materialId = detectMaterialFromText(normalized);
  const finishId = detectFinishFromText(normalized);
  const dimensions = extractDimensionsFromQuery(normalized);
  const budgetIdr = extractBudgetFromText(raw);
  const detectedCity = detectCityCoverage(normalized);
  const detectedRoom = detectRoomFromText(normalized);
  const detectedDesignStyle = detectDesignStyle(normalized);
  const detectedHardwareOrShape = detectHardwareOrShape(normalized);
  const greetingVariant = detectGreetingVariant(normalized);

  const asksDirectContact =
    /\b(hubungi|kontak|whatsapp|chat\s+admin|chat\s+langsung|bicara\s+dengan|nomor\s+admin|telepon|admin\s+langsung)\b/.test(
      normalized
    );

  const asksCustomException =
    /\b(desain\s+saja|jasa\s+desain|tukar\s+tambah|beli\s+bahan|lembaran\s+saja|reparasi|servis\s+lama|cat\s+ulang|cicilan\s+tanpa\s+dp|kartu\s+kredit|leasing)\b/.test(
      normalized
    );

  const asksComparison =
    /\b(bedanya|perbedaan|banding|bandingkan|komparasi|vs|dibanding|lebih\s+bagus|lebih\s+awet|lebih\s+murah|bagus\s+mana|cocok\s+untuk|kelebihan|anti-air|anti-rayap|lembap)\b/.test(
      normalized
    );

  const asksPromo = /\b(promo|diskon|potongan|hemat|penawaran)\b/.test(normalized);

  const asksIncludes = /\b(kelengkapan|include|engsel|soft-close|rak\s+piring|dapat\s+apa|bawaan)\b/.test(
    normalized
  );

  const asksMdfOrParticle = /\b(mdf|particle-board|hpl\s+vs\s+mdf)\b/.test(normalized);
  const asksCheapOrMin = /\b(murah|termurah|paling\s+murah|hemat|ekonomis|terjangkau|mulai\s+berapa|minimal)\b/.test(
    normalized
  );
  const asksBestOrDurable = /\b(awet|terbaik|paling\s+bagus|paling\s+kuat|kokoh|tahan\s+lama|rekomendasi\s+terbaik)\b/.test(
    normalized
  );
  const asksFreeDesign = /\b(gratis\s+desain|desain\s+3d|gambar\s+3d|desain\s+bayar|biaya\s+desain)\b/.test(
    normalized
  );
  const asksShippingOrInstallFee = /\b(ongkir|ongkos\s+pasang|biaya\s+survei|gratis\s+survei|termasuk\s+pasang|sudah\s+pasang)\b/.test(
    normalized
  );
  const asksNegotiationOrBundle = /\b(nego|tawar|pesan\s+banyak|borongan|satu\s+rumah|full\s+interior|paket\s+rumah)\b/.test(
    normalized
  );
  const asksCustomReference = /\b(bawa\s+gambar|referensi\s+sendiri|pinterest|model\s+sendiri|request\s+model|custom\s+model)\b/.test(
    normalized
  );

  const isFollowUpModifier =
    /^(kalau|ganti|coba|ubah|pakai|ukuran|yang|terus|kalau\s+pakai|lebih)\b/.test(normalized) ||
    (tokens.length <= 5 && (Boolean(dimensions) || Boolean(materialId) || Boolean(finishId)));

  if (!normalized || (greetingVariant && tokens.length <= 5 && !dimensions && !budgetIdr && !materialId)) {
    return {
      raw,
      normalized,
      tokens,
      stemmedTokens,
      expandedTokens,
      extractedKeywords,
      materialId,
      finishId,
      dimensions,
      budgetIdr,
      detectedCity,
      detectedRoom,
      detectedDesignStyle,
      detectedHardwareOrShape,
      greetingVariant: greetingVariant ?? 'casual',
      asksDirectContact: false,
      asksCustomException: false,
      asksComparison: false,
      asksPromo: false,
      asksIncludes: false,
      asksMdfOrParticle: false,
      asksCheapOrMin: false,
      asksBestOrDurable: false,
      asksFreeDesign: false,
      asksShippingOrInstallFee: false,
      asksNegotiationOrBundle: false,
      asksCustomReference: false,
      isFollowUpModifier: false,
      intent: 'identitas',
      secondaryIntents: [],
      confidence: 1,
    };
  }

  if (CLOSING_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return {
      raw,
      normalized,
      tokens,
      stemmedTokens,
      expandedTokens,
      extractedKeywords,
      materialId,
      finishId,
      dimensions,
      budgetIdr,
      detectedCity,
      detectedRoom,
      detectedDesignStyle,
      detectedHardwareOrShape,
      greetingVariant: null,
      asksDirectContact: false,
      asksCustomException: false,
      asksComparison: false,
      asksPromo: false,
      asksIncludes: false,
      asksMdfOrParticle: false,
      asksCheapOrMin: false,
      asksBestOrDurable: false,
      asksFreeDesign: false,
      asksShippingOrInstallFee: false,
      asksNegotiationOrBundle: false,
      asksCustomReference: false,
      isFollowUpModifier: false,
      intent: 'penutup',
      secondaryIntents: [],
      confidence: 0.95,
    };
  }

  const hasExplicitPriceIntent =
    /\b(harga|biaya|tarif|estimasi|hitung|berapa|daftar\s+harga|mulai)\b/.test(normalized);

  const scoredIntents: Array<{ intent: SainAiIntent; score: number }> = [];

  for (const rule of INTENT_RULES) {
    let score = 0;
    let synonymHits = 0;

    for (const kw of rule.keywords) {
      if (matchesKeywordWithBoundaries(normalized, kw)) {
        score += rule.weight + (kw.includes(' ') ? 1.5 : 0);
      } else if (
        !kw.includes(' ') &&
        stemmedTokens.some((stem) => stem === kw || stem === stemIndonesianWord(kw))
      ) {
        score += rule.weight * 0.85;
      } else if (
        !kw.includes(' ') &&
        kw.length >= 5 &&
        tokens.some((tok) => isFuzzyWordMatch(tok, kw))
      ) {
        score += rule.weight * 0.72;
      } else if (!kw.includes(' ') && expandedTokens.includes(kw) && synonymHits < 3) {
        score += rule.weight * 0.45;
        synonymHits += 1;
      }
    }

    if (rule.intent === 'budget_planner' && budgetIdr) {
      score += 6.2;
    }

    if (rule.intent === 'promo_katalog' && asksPromo && !dimensions && !hasExplicitPriceIntent) {
      score += 4.2;
    }

    if (
      rule.intent === 'layanan_biaya' &&
      (asksFreeDesign || asksShippingOrInstallFee || asksNegotiationOrBundle || asksCustomReference)
    ) {
      score += 4.6;
    }

    if (rule.intent === 'harga_estimasi') {
      if (dimensions && !budgetIdr) {
        score += 4.6;
      }
      if (hasExplicitPriceIntent && !asksComparison && !budgetIdr && !asksShippingOrInstallFee && !asksFreeDesign) {
        score += 3.6;
      }
    }

    if (
      rule.intent === 'material_finishing' &&
      (asksComparison || asksMdfOrParticle || asksBestOrDurable) &&
      !dimensions &&
      !hasExplicitPriceIntent &&
      !budgetIdr
    ) {
      score += 4.0;
    }

    if (rule.intent === 'survei_lokasi' && detectedCity) {
      score += 4.5;
    }

    if (rule.intent === 'produk_katalog' && detectedRoom && !hasExplicitPriceIntent && !dimensions && !budgetIdr) {
      score += 2.2;
    }

    if (score > 0) {
      scoredIntents.push({ intent: rule.intent, score });
    }
  }

  scoredIntents.sort((a, b) => b.score - a.score);

  let bestIntent: SainAiIntent = scoredIntents[0]?.intent ?? 'fallback';
  let bestScore = scoredIntents[0]?.score ?? 0;

  if (bestIntent === 'fallback' && (materialId || finishId || asksMdfOrParticle)) {
    bestIntent = 'material_finishing';
    bestScore = 3.2;
  } else if (bestIntent === 'fallback' && detectedRoom) {
    bestIntent = 'produk_katalog';
    bestScore = 3.0;
  }

  const secondaryIntents = scoredIntents
    .slice(1)
    .filter((entry) => entry.intent !== bestIntent && entry.score >= 3.2)
    .slice(0, 2)
    .map((entry) => entry.intent);

  return {
    raw,
    normalized,
    tokens,
    stemmedTokens,
    expandedTokens,
    extractedKeywords,
    materialId,
    finishId,
    dimensions,
    budgetIdr,
    detectedCity,
    detectedRoom,
    detectedDesignStyle,
    detectedHardwareOrShape,
    greetingVariant,
    asksDirectContact,
    asksCustomException,
    asksComparison,
    asksPromo,
    asksIncludes,
    asksMdfOrParticle,
    asksCheapOrMin,
    asksBestOrDurable,
    asksFreeDesign,
    asksShippingOrInstallFee,
    asksNegotiationOrBundle,
    asksCustomReference,
    isFollowUpModifier,
    intent: bestScore > 0 ? bestIntent : 'fallback',
    secondaryIntents,
    confidence: Math.min(1, bestScore / 8),
  };
}
