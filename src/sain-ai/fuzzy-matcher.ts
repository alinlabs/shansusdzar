/**
 * Utilitas normalisasi bahasa Indonesia sehari-hari, singkatan chat,
 * stemming ringan kata berimbuhan, toleransi salah ketik (Damerau-Levenshtein),
 * dan ekstraksi nominal anggaran.
 */

const PHRASE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bkitchen\s*set\b/gi, 'kitchen set'],
  [/\bkitchenset\b/gi, 'kitchen set'],
  [/\bkitcen\s*set\b/gi, 'kitchen set'],
  [/\bcat\s*duko\b/gi, 'cat duco'],
  [/\bcatduco\b/gi, 'cat duco'],
  [/\bblok\s*board\b/gi, 'blockboard'],
  [/\bblok\s*bod\b/gi, 'blockboard'],
  [/\bblock\s*board\b/gi, 'blockboard'],
  [/\bparticle\s*board\b/gi, 'particle-board'],
  [/\bpartikel\s*board\b/gi, 'particle-board'],
  [/\bserbuk\s*kayu\b/gi, 'particle-board'],
  [/\bsoft\s*close\b/gi, 'soft-close'],
  [/\bsoftclose\b/gi, 'soft-close'],
  [/\bslow\s*motion\b/gi, 'soft-close'],
  [/\blemari\s+baju\b/gi, 'lemari pakaian'],
  [/\blemari\s+baju\s+sliding\b/gi, 'lemari pakaian sliding'],
  [/\btempat\s+tidur\b/gi, 'divan tempat tidur'],
  [/\branjang\b/gi, 'divan tempat tidur'],
  [/\bmeja\s+tv\b/gi, 'credenza meja tv'],
  [/\brak\s+tv\b/gi, 'credenza meja tv'],
  [/\bbuffet\s+tv\b/gi, 'credenza meja tv'],
  [/\bbufet\s+tv\b/gi, 'credenza meja tv'],
  [/\bmeja\s+dandan\b/gi, 'meja rias'],
  [/\bmeja\s+makeup\b/gi, 'meja rias'],
  [/\bmeja\s+make\s*up\b/gi, 'meja rias'],
  [/\bmeja\s+belajar\b/gi, 'meja kerja belajar'],
  [/\bmeja\s+kantor\b/gi, 'meja kerja belajar'],
  [/\bmeja\s+komputer\b/gi, 'meja kerja belajar'],
  [/\bbawah\s+tangga\b/gi, 'kabinet bawah tangga'],
  [/\brak\s+sepatu\b/gi, 'lemari sepatu'],
  [/\btempat\s+sepatu\b/gi, 'lemari sepatu'],
  [/\bruang\s+cuci\b/gi, 'laundry cabinet'],
  [/\bmesin\s+cuci\b/gi, 'laundry cabinet'],
  [/\bkamar\s+mandi\b/gi, 'vanity kamar mandi'],
  [/\bmeja\s+wastafel\b/gi, 'vanity kamar mandi'],
  [/\bkisi[\s-]+kisi\b/gi, 'wall panel kisi'],
  [/\bwpc\s+wall\s*panel\b/gi, 'wall panel'],
  [/\bpenyekat\s+ruangan\b/gi, 'partisi ruangan'],
  [/\bpembatas\s+ruangan\b/gi, 'partisi ruangan'],
  [/\bmeja\s+bar\b/gi, 'island meja bar'],
  [/\bmini\s*bar\b/gi, 'island meja bar'],
  [/\buang\s+muka\b/gi, 'dp uang muka'],
  [/\bongkos\s+kirim\b/gi, 'ongkir'],
  [/\bbiaya\s+kirim\b/gi, 'ongkir'],
  [/\bbiaya\s+antar\b/gi, 'ongkir'],
  [/\bbiaya\s+pasang\b/gi, 'ongkos pasang'],
  [/\bbiaya\s+instalasi\b/gi, 'ongkos pasang'],
  [/\bbiaya\s+survei\b/gi, 'biaya survei'],
  [/\bbiaya\s+survey\b/gi, 'biaya survei'],
  [/\bgratis\s+survei\b/gi, 'gratis survei'],
  [/\bfree\s+survei\b/gi, 'gratis survei'],
  [/\bfree\s+survey\b/gi, 'gratis survei'],
  [/\bfree\s+desain\b/gi, 'gratis desain'],
  [/\bfree\s+design\b/gi, 'gratis desain'],
  [/\bgratis\s+design\b/gi, 'gratis desain'],
  [/\banti\s+air\b/gi, 'anti-air'],
  [/\btahan\s+air\b/gi, 'anti-air'],
  [/\banti\s+rayap\b/gi, 'anti-rayap'],
  [/\bmeter\s+lari\b/gi, 'meter-lari'],
  [/\bmeter\s+persegi\b/gi, 'm2'],
  [/\bprice\s*list\b/gi, 'daftar harga'],
  [/\bdaftar\s+harga\b/gi, 'daftar harga'],
  [/\blist\s+harga\b/gi, 'daftar harga'],
  [/\bleter\s+l\b/gi, 'l-shape'],
  [/\bletter\s+l\b/gi, 'l-shape'],
  [/\bhuruf\s+l\b/gi, 'l-shape'],
  [/\bmodel\s+l\b/gi, 'l-shape'],
  [/\bleter\s+u\b/gi, 'u-shape'],
  [/\bletter\s+u\b/gi, 'u-shape'],
  [/\bhuruf\s+u\b/gi, 'u-shape'],
  [/\bpintu\s+geser\b/gi, 'sliding'],
  [/\bpintu\s+ayun\b/gi, 'swing'],
  [/\btidak\s+tahu\b/gi, 'tidak'],
  [/\bassalamu[\s']*alaikum\b/gi, 'assalamualaikum'],
  [/\bsalam\s+kenal\b/gi, 'halo'],
  [/\bmakasih\s+banyak\b/gi, 'terima kasih'],
  [/\bterimakasih\b/gi, 'terima kasih'],
];

const TOKEN_SLANG_MAP: Record<string, string> = {
  brp: 'berapa',
  brpa: 'berapa',
  brph: 'berapa',
  hrg: 'harga',
  hrga: 'harga',
  hrgnya: 'harga',
  harganya: 'harga',
  biayanya: 'biaya',
  tarifnya: 'tarif',
  ongkosnya: 'biaya',
  uk: 'ukuran',
  ukr: 'ukuran',
  ukrn: 'ukuran',
  ukuranya: 'ukuran',
  ukurannya: 'ukuran',
  yg: 'yang',
  dgn: 'dengan',
  dg: 'dengan',
  sm: 'sama',
  utk: 'untuk',
  bwt: 'buat',
  bt: 'buat',
  klo: 'kalau',
  kl: 'kalau',
  klw: 'kalau',
  kalo: 'kalau',
  misal: 'kalau',
  misalnya: 'kalau',
  umpama: 'kalau',
  gmn: 'gimana',
  gmna: 'gimana',
  bgmn: 'bagaimana',
  bgm: 'bagaimana',
  bs: 'bisa',
  bsa: 'bisa',
  blh: 'boleh',
  dpt: 'dapat',
  dapet: 'dapat',
  gak: 'tidak',
  gk: 'tidak',
  ga: 'tidak',
  nggak: 'tidak',
  ngga: 'tidak',
  enggak: 'tidak',
  tdk: 'tidak',
  blm: 'belum',
  blum: 'belum',
  sdh: 'sudah',
  udh: 'sudah',
  uda: 'sudah',
  udah: 'sudah',
  aja: 'saja',
  aj: 'saja',
  sj: 'saja',
  doang: 'saja',
  lg: 'lagi',
  lgi: 'lagi',
  sy: 'saya',
  aku: 'saya',
  aq: 'saya',
  gw: 'saya',
  gue: 'saya',
  min: 'admin',
  mimin: 'admin',
  kak: 'admin',
  kaka: 'admin',
  mas: 'admin',
  mbak: 'admin',
  bang: 'admin',
  gan: 'admin',
  sis: 'admin',
  bro: 'admin',
  bos: 'admin',
  sain: 'sain',
  sahabat: 'sahabat',
  cs: 'admin',
  pwk: 'purwakarta',
  krw: 'karawang',
  bdg: 'bandung',
  bks: 'bekasi',
  ckr: 'cikarang',
  sbg: 'subang',
  jkt: 'jakarta',
  bgr: 'bogor',
  dpk: 'depok',
  tgr: 'tangerang',
  crb: 'cirebon',
  grt: 'garut',
  tsm: 'tasikmalaya',
  sby: 'surabaya',
  smg: 'semarang',
  yogya: 'yogyakarta',
  multipex: 'multipleks',
  multiplek: 'multipleks',
  multiplex: 'multipleks',
  triplek: 'multipleks',
  tripleks: 'multipleks',
  tripek: 'multipleks',
  plywood: 'multipleks',
  playwood: 'multipleks',
  blokboard: 'blockboard',
  blokbod: 'blockboard',
  blokbord: 'blockboard',
  duko: 'duco',
  catduko: 'duco',
  finising: 'finishing',
  finishingnya: 'finishing',
  laminat: 'laminasi',
  taco: 'hpl',
  tacoo: 'hpl',
  wardrob: 'wardrobe',
  wadrobe: 'wardrobe',
  wadrdobe: 'wardrobe',
  almari: 'lemari',
  kredeza: 'credenza',
  kredenza: 'credenza',
  kichen: 'kitchen',
  kitcen: 'kitchen',
  dpur: 'dapur',
  surve: 'survei',
  survey: 'survei',
  surpey: 'survei',
  surveiin: 'survei',
  ngukur: 'ukur',
  diukur: 'ukur',
  pengukurannya: 'ukur',
  dateng: 'datang',
  visit: 'survei',
  katalok: 'katalog',
  pricelist: 'harga',
  spek: 'spesifikasi',
  detil: 'detail',
  diskon: 'promo',
  potongan: 'promo',
  cashback: 'promo',
  murmer: 'murah',
  bajet: 'budget',
  bujet: 'budget',
  dananya: 'budget',
  dana: 'budget',
  duit: 'budget',
  uangnya: 'budget',
  makasih: 'terima kasih',
  thx: 'terima kasih',
  tq: 'terima kasih',
  thanks: 'terima kasih',
  nuhun: 'terima kasih',
  haturnuhun: 'terima kasih',
  mksh: 'terima kasih',
  mantap: 'oke',
  sip: 'oke',
  siap: 'oke',
  ok: 'oke',
  okei: 'oke',
  tlg: 'tolong',
  mhn: 'tolong',
  pls: 'tolong',
  plis: 'tolong',
  infoin: 'info',
  tnya: 'tanya',
  nanya: 'tanya',
  nyari: 'cari',
  cariin: 'cari',
  rekomend: 'rekomendasi',
  rekomen: 'rekomendasi',
  rekom: 'rekomendasi',
  perlu: 'butuh',
  bth: 'butuh',
  mw: 'mau',
  mo: 'mau',
  pengen: 'mau',
  pingin: 'mau',
  ingin: 'mau',
  hr: 'hari',
  bln: 'bulan',
  thn: 'tahun',
  dpnya: 'dp',
  terminnya: 'termin',
  estimasiin: 'estimasi',
  hitungkan: 'hitung',
  itung: 'hitung',
  itungin: 'hitung',
  bikinin: 'buat',
  bikin: 'buat',
  buatin: 'buat',
  pesen: 'pesan',
  pesenin: 'pesan',
  pasangin: 'pasang',
  dipasang: 'pasang',
  pemasangannya: 'pasang',
  krm: 'kirim',
  dikirim: 'kirim',
  pengiriman: 'kirim',
  dmn: 'dimana',
  dmna: 'dimana',
  lok: 'lokasi',
  almt: 'alamat',
  jdwl: 'jadwal',
  wa: 'whatsapp',
  wasap: 'whatsapp',
  watsap: 'whatsapp',
  nomer: 'nomor',
  no: 'nomor',
  tlp: 'telepon',
  telp: 'telepon',
  hub: 'hubungi',
  hubungin: 'hubungi',
  lembab: 'lembap',
  keropos: 'lapuk',
  awetan: 'awet',
  bagusan: 'bagus',
  mendingan: 'lebih bagus',
  mending: 'lebih bagus',
  nyicil: 'cicil',
  cicilan: 'cicil',
  angsuran: 'cicil',
  tf: 'transfer',
  trf: 'transfer',
  rek: 'rekening',
  spesifikasinya: 'spesifikasi',
  bahannya: 'bahan',
  bahanya: 'bahan',
  materialnya: 'material',
  warnanya: 'warna',
  modelnya: 'model',
  prosesnya: 'proses',
  caranya: 'cara',
  garansinya: 'garansi',
  promonya: 'promo',
  contohnya: 'contoh',
  sampelnya: 'sampel',
  mtr: 'meter',
  req: 'request',
  kostum: 'custom',
  kustom: 'custom',
  raknya: 'rak',
  lemarinya: 'lemari',
  dapurku: 'dapur',
  kamarku: 'kamar',
  rumahku: 'rumah',
  tokoku: 'toko',
};

const PRESERVE_ROOTS = new Set([
  'kitchen',
  'multipleks',
  'blockboard',
  'purwakarta',
  'karawang',
  'cikarang',
  'bandung',
  'subang',
  'bekasi',
  'jakarta',
  'surabaya',
  'tasikmalaya',
  'yogyakarta',
  'semarang',
  'cirebon',
  'lemari',
  'credenza',
  'backdrop',
  'partisi',
  'vanity',
  'laundry',
  'headboard',
  'wardrobe',
  'divan',
  'nakas',
  'kabinet',
  'komersial',
  'minimalis',
  'industrial',
  'japandi',
  'finishing',
  'laminasi',
  'garansi',
  'estimasi',
  'material',
  'operasional',
  'portofolio',
  'testimoni',
  'interior',
  'custom',
  'workshop',
  'whatsapp',
  'instagram',
  'invoice',
  'termin',
  'gratis',
  'promo',
  'survey',
  'survei',
  'desain',
  'ukuran',
  'wilayah',
  'daerah',
  'alamat',
  'lokasi',
  'warna',
  'harga',
  'biaya',
  'budget',
  'engsel',
  'sliding',
  'swing',
  'pelapis',
  'perawatan',
  'pemasangan',
  'pengukuran',
  'pengerjaan',
  'pembayaran',
  'perbandingan',
  'rekomendasi',
  'dengan',
  'jangan',
  'bukan',
  'bagian',
  'karena',
  'seperti',
  'antara',
  'setelah',
  'sebelum',
  'selama',
  'supaya',
  'hingga',
  'sampai',
  'adalah',
  'hanya',
  'sedang',
  'masih',
  'harus',
  'punya',
  'cukup',
  'kapan',
  'siapa',
  'berapa',
  'dimana',
  'bagaimana',
  'apakah',
  'nominal',
  'maksimal',
  'minimal',
  'modal',
]);

/**
 * Stemming ringan Bahasa Indonesia untuk mengekstrak akar kata dari bentuk berimbuhan
 * seperti "ukurannya" -> "ukuran", "dipasang" -> "pasang", "bergaransi" -> "garansi",
 * "merawatnya" -> "rawat", "pengerjaan" -> "kerja".
 */
export function stemIndonesianWord(word: string): string {
  const clean = word.toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (clean.length <= 4 || /^\d+$/.test(clean) || PRESERVE_ROOTS.has(clean)) {
    return clean;
  }

  let stem = clean;

  // 1. Hapus partikel & pronomina penutup (-kah, -lah, -pun, -nya, -ku, -mu)
  stem = stem.replace(/(?:kah|lah|pun|nya|ku|mu)$/, '');
  if (stem.length <= 3) return clean;
  if (PRESERVE_ROOTS.has(stem)) return stem;

  // 2. Hapus prefiks umum Bahasa Indonesia jika sisa kata >= 4 huruf
  const prefixRules: RegExp[] = [
    /^(?:di|ke|se|ber|ter)/,
    /^(?:peng|pem|pen|pe)/,
    /^(?:meng|mem|men|me)/,
  ];
  for (const rule of prefixRules) {
    if (rule.test(stem)) {
      const candidate = stem.replace(rule, '');
      if (candidate.length >= 4) {
        stem = candidate;
        break;
      }
    }
  }

  if (PRESERVE_ROOTS.has(stem)) return stem;

  // 3. Hapus sufiks (-kan, -an, -i) jika sisa kata >= 4 huruf
  if (/(?:kan|an|i)$/.test(stem)) {
    const candidate = stem.replace(/(?:kan|an|i)$/, '');
    if (candidate.length >= 4) {
      stem = candidate;
    }
  }

  return stem.length >= 3 ? stem : clean;
}

export function normalizeChatText(raw: string): string {
  let text = raw
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s.,x×*/-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  for (const [pattern, replacement] of PHRASE_REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }

  // Normalisasi singkatan token per kata (kecuali angka/dimensi seperti 250x220)
  const words = text.split(' ').map((word) => {
    if (/^\d/.test(word)) return word;
    const stripped = word.replace(/^[.,-]+|[.,-]+$/g, '');
    return TOKEN_SLANG_MAP[stripped] ?? word;
  });

  return words.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Menghitung jarak Damerau-Levenshtein terbatas untuk toleransi typo ringan.
 */
export function damerauLevenshtein(a: string, b: string): number {
  const lenA = a.length;
  const lenB = b.length;
  if (lenA === 0) return lenB;
  if (lenB === 0) return lenA;

  const dp: number[][] = Array.from({ length: lenA + 1 }, () =>
    Array(lenB + 1).fill(0)
  );

  for (let i = 0; i <= lenA; i += 1) dp[i][0] = i;
  for (let j = 0; j <= lenB; j += 1) dp[0][j] = j;

  for (let i = 1; i <= lenA; i += 1) {
    for (let j = 1; j <= lenB; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
      }
    }
  }

  return dp[lenA][lenB];
}

export function isFuzzyWordMatch(queryToken: string, targetWord: string): boolean {
  if (queryToken === targetWord) return true;
  if (queryToken.length < 5 || targetWord.length < 5) return false;
  if (Math.abs(queryToken.length - targetWord.length) > 2) return false;

  const sameFirst = queryToken[0] === targetWord[0];
  const swappedStart =
    queryToken[0] === targetWord[1] && queryToken[1] === targetWord[0];
  if (!sameFirst && !swappedStart) return false;

  const maxDist = targetWord.length >= 9 && queryToken.length >= 9 ? 2 : 1;
  return damerauLevenshtein(queryToken, targetWord) <= maxDist;
}

/**
 * Mengekstrak anggaran Rupiah dari frasa seperti:
 * "10 juta", "8.5 jt", "12 jutaan", "Rp 15.000.000", "7500rb", "5000k", "5000000"
 */
export function extractBudgetFromText(raw: string): number | null {
  const lower = raw.toLowerCase();

  // Format jutaan: "10 juta", "8,5 jt", "12 jutaan"
  const millionMatch = lower.match(
    /\b(?:rp\.?\s*)?(\d+(?:[.,]\d+)?)\s*(?:jutaan|juta|jt)\b/i
  );
  if (millionMatch) {
    const num = Number(millionMatch[1].replace(',', '.'));
    if (Number.isFinite(num) && num >= 0.5 && num <= 500) {
      return Math.round(num * 1_000_000);
    }
  }

  // Format ribuan: "5000rb", "7500 ribu", "5000k"
  const thousandMatch = lower.match(
    /\b(?:rp\.?\s*)?(\d+(?:[.,]\d+)?)\s*(?:ribu|rb|k)\b/i
  );
  if (thousandMatch) {
    const num = Number(thousandMatch[1].replace(',', '.'));
    if (Number.isFinite(num) && num >= 500 && num <= 500_000) {
      return Math.round(num * 1_000);
    }
  }

  // Format nominal Rupiah penuh: "Rp 10.000.000" atau "Rp10000000"
  const fullIdrMatch = lower.match(
    /(?:rp\.?\s*)(\d{1,3}(?:\.\d{3}){2,}|\d{7,9})\b/i
  );
  if (fullIdrMatch) {
    const cleaned = Number(fullIdrMatch[1].replace(/\./g, ''));
    if (Number.isFinite(cleaned) && cleaned >= 500_000 && cleaned <= 500_000_000) {
      return cleaned;
    }
  }

  // Format jutaan tanpa prefix Rp tapi disertai konteks budget/dana/anggaran/uang
  if (/\b(budget|bajet|bujet|dana|dananya|anggaran|maksimal|punya|nominal|sekitar|duit|modal|uang)\b/.test(lower)) {
    const bareMillionMatch = lower.match(/\b(\d{1,3}(?:\.\d{3}){2}|\d{7,9})\b/);
    if (bareMillionMatch) {
      const cleaned = Number(bareMillionMatch[1].replace(/\./g, ''));
      if (Number.isFinite(cleaned) && cleaned >= 500_000 && cleaned <= 500_000_000) {
        return cleaned;
      }
    }
  }

  return null;
}
