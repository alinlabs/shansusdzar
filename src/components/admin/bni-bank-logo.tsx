import { resolveWorkshopBankAccounts } from '../../lib/business-config';
import type { BusinessBankAccount, BusinessConfig } from '../../types/business';

export function BniBankLogo({ className = 'h-7 w-auto' }: { className?: string }) {
  return (
    <img
      src="/bni.webp"
      alt="Logo Bank BNI"
      className={`${className} object-contain select-none`}
      draggable={false}
      decoding="async"
    />
  );
}

export function BsiBankLogo({ className = 'h-7 w-auto' }: { className?: string }) {
  return (
    <img
      src="/bsi.webp"
      alt="Logo Bank BSI"
      className={`${className} object-contain select-none`}
      draggable={false}
      decoding="async"
    />
  );
}

function getBankAccentColors(bank: BusinessBankAccount): {
  primary: string;
  secondary: string;
} {
  const code = `${bank.namaBank} ${bank.namaLengkapBank}`.toUpperCase();
  if (code.includes('BSI') || code.includes('SYARIAH')) {
    return { primary: '#00A39D', secondary: '#F9A01B' };
  }
  return { primary: '#005E6A', secondary: '#F15A23' };
}

function BankBrandLogo({
  bank,
  className = 'h-7 w-auto',
}: {
  bank: BusinessBankAccount;
  className?: string;
}) {
  const code = `${bank.namaBank} ${bank.namaLengkapBank}`.toUpperCase();
  if (code.includes('BSI') || code.includes('SYARIAH')) {
    return <BsiBankLogo className={className} />;
  }
  if (!bank.logoUrl || bank.logoUrl === '/bni.webp' || bank.logoUrl === '/bni.png') {
    return <BniBankLogo className={className} />;
  }
  return (
    <img
      src={bank.logoUrl}
      alt={`Logo ${bank.namaLengkapBank}`}
      className={`${className} object-contain select-none`}
      draggable={false}
      decoding="async"
    />
  );
}

export function FormalBankPaymentCard({
  businessConfig,
  referenceLabel,
  className = '',
}: {
  businessConfig: BusinessConfig;
  referenceLabel?: string;
  className?: string;
}) {
  const banks = resolveWorkshopBankAccounts(businessConfig);
  return (
    <div data-testid="bank-payment-card" className={`space-y-2 ${className}`}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {banks.map((bank) => {
          const accent = getBankAccentColors(bank);
          const displayBankName = bank.namaLengkapBank
            .replace(/\s*\([^)]*\)\s*/g, '')
            .trim()
            .toUpperCase();
          return (
            <div
              key={`${bank.namaBank}-${bank.nomorRekening}`}
              data-testid={`bank-payment-card-${bank.namaBank.toLowerCase()}`}
              className="border border-[#1e1e1e] bg-[#f8fafb] flex flex-col justify-between"
            >
              <div className="h-1.5 flex" style={{ backgroundColor: accent.primary }}>
                <span className="w-16" style={{ backgroundColor: accent.secondary }} />
              </div>
              <div className="px-4 py-3 flex items-center justify-between gap-3">
                <div className="shrink-0 bg-white border border-[#d6dfe2] px-3 py-2 flex items-center justify-center min-w-[92px] h-11">
                  <BankBrandLogo bank={bank} className="h-6 max-w-[76px] w-auto" />
                </div>
                <div className="min-w-0 text-right space-y-0.5">
                  <p className="text-[9px] font-normal uppercase tracking-wider text-[#5a5a5a] truncate">
                    {displayBankName}
                  </p>
                  <p className="font-bold text-sm sm:text-base tracking-wide text-[#141414] tabular-nums">
                    {bank.nomorRekening}
                  </p>
                  <p className="text-[11px] font-bold uppercase tracking-wide text-[#141414] truncate">
                    {bank.atasNama.toUpperCase()}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#373737] px-1">
        <span>Rekening Pembayaran Resmi ({banks.map((b) => b.namaBank).join(' / ')})</span>
        <span className="tabular-nums">
          {referenceLabel ? `Cantumkan ref: ${referenceLabel} · ` : ''}
          Konfirmasi transfer: WA {businessConfig.whatsapp.nomorTampil}
        </span>
      </div>
    </div>
  );
}
