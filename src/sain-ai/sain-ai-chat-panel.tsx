import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  ArrowUpRight,
  Calculator,
  Layers,
  Lightbulb,
  MapPin,
  Maximize2,
  MessageCircle,
  Minimize2,
  Package,
  RotateCcw,
  SendHorizontal,
  Wallet,
  X,
} from 'lucide-react';
import { Link } from 'react-router';
import { TextareaScrollIndicator } from '../components/ui/textarea-scroll-indicator';
import { SAIN_AI_STARTER_PROMPTS } from './engine';
import { resolveActiveRecommendations } from './response-composer';
import { formatChatTimestamp } from './typing-delay';
import type { SainAiMessage } from './types';

interface SainAiChatPanelProps {
  messages: SainAiMessage[];
  isTyping?: boolean;
  variant: 'desktop' | 'mobile';
  onSendMessage: (text: string) => void;
  onResetConversation: () => void;
  onClose: () => void;
  onHeaderPointerDown?: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onHeaderDoubleClick?: () => void;
  isDragging?: boolean;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

const WELCOME_STARTER_CARDS = [
  {
    id: 'card-estimasi',
    title: 'Hitung Estimasi',
    subtitle: 'Kitchen set 250×220 Multipleks HPL',
    prompt: 'Estimasi kitchen set 250x220 multipleks HPL',
    icon: Calculator,
  },
  {
    id: 'card-budget',
    title: 'Sesuaikan Budget',
    subtitle: 'Simulasi unit & ukuran dana Rp 10 juta',
    prompt: 'Dengan budget 10 juta cukup untuk apa saja?',
    icon: Wallet,
  },
  {
    id: 'card-material',
    title: 'Bandingkan Bahan',
    subtitle: 'Blockboard, Multipleks & PVC 18 mm',
    prompt: 'Apa bedanya Blockboard, Multipleks, dan PVC Board 18 mm?',
    icon: Layers,
  },
  {
    id: 'card-survei',
    title: 'Cek Wilayah Survei',
    subtitle: 'Jangkauan kota, jadwal & sampel bahan',
    prompt: 'Wilayah mana saja yang masuk area survei dan jam buka workshop?',
    icon: MapPin,
  },
];

function MediaThumbWithFallback({ src, alt }: { src: string; alt: string }) {
  const [hasError, setHasError] = useState(false);

  if (hasError || !src) {
    return (
      <div
        aria-hidden="true"
        className="size-11 rounded-[var(--radius-sm)] bg-[var(--surface-muted)] border border-[var(--border)] flex items-center justify-center shrink-0 text-[var(--text-subtle)]"
      >
        <Package className="size-4" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className="size-11 rounded-[var(--radius-sm)] object-cover shrink-0 bg-[var(--surface-muted)]"
    />
  );
}

export function SainAiChatPanel({
  messages,
  isTyping = false,
  variant,
  onSendMessage,
  onResetConversation,
  onClose,
  onHeaderPointerDown,
  onHeaderDoubleClick,
  isDragging = false,
  isExpanded = false,
  onToggleExpand,
}: SainAiChatPanelProps) {
  const [draft, setDraft] = useState('');
  const [recommendationsOpen, setRecommendationsOpen] = useState<boolean | null>(null);
  const scrollListRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isInitialEmptyThread = messages.length <= 1 && !isTyping;
  const isRecommendationsVisible = recommendationsOpen ?? !isInitialEmptyThread;
  const activeRecommendations = resolveActiveRecommendations({
    messages,
    isTyping,
    starterPrompts: SAIN_AI_STARTER_PROMPTS,
  });

  useEffect(() => {
    const container = scrollListRef.current;
    if (!container) return;
    const lastIndex = messages.length - 1;
    const lastMessage = messages[lastIndex];

    if (lastMessage?.sender === 'assistant' && messages.length > 1) {
      let anchorIndex = lastIndex;
      if (lastMessage.bubbleRole === 'followup') {
        for (let i = lastIndex - 1; i >= 0; i -= 1) {
          if (messages[i]?.bubbleRole === 'core') {
            anchorIndex = i;
            break;
          }
          if (messages[i]?.sender === 'user') break;
        }
      }

      if (lastMessage.bubbleRole === 'core' || lastMessage.bubbleRole === 'followup') {
        const anchorEl = container.querySelector<HTMLElement>(
          `[data-sain-turn-index="${anchorIndex}"]`
        );
        if (anchorEl) {
          const remainingHeight = container.scrollHeight - anchorEl.offsetTop;
          if (remainingHeight > container.clientHeight - 16) {
            container.scrollTo({
              top: Math.max(0, anchorEl.offsetTop - 12),
              behavior: 'smooth',
            });
            return;
          }
        }
      }
    }

    container.scrollTo({
      top: container.scrollHeight,
      behavior: messages.length > 1 || isTyping ? 'smooth' : 'auto',
    });
  }, [messages, isTyping]);

  useEffect(() => {
    if (variant === 'desktop') {
      const timer = window.setTimeout(() => {
        textareaRef.current?.focus({ preventScroll: true });
      }, 60);
      return () => window.clearTimeout(timer);
    }
  }, [variant]);

  const adjustTextareaHeight = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 80)}px`;
  };

  const submitPrompt = () => {
    if (isTyping) return;
    const cleaned = draft.trim();
    if (!cleaned) return;
    onSendMessage(cleaned);
    setDraft('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      if (!isTyping) {
        submitPrompt();
      }
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-[var(--surface)] text-[var(--text)]">
      {/* Header Chat (Draggable pada Desktop) */}
      <div
        data-testid="sain-ai-chat-header"
        onPointerDown={variant === 'desktop' ? onHeaderPointerDown : undefined}
        onDoubleClick={variant === 'desktop' ? onHeaderDoubleClick : undefined}
        className={[
          'shrink-0 px-3.5 py-2.5 md:px-4 md:py-2.5 border-b border-[var(--border)] flex items-center justify-between gap-2 select-none',
          variant === 'desktop'
            ? isDragging
              ? 'cursor-grabbing bg-[var(--surface-elevated)]'
              : 'cursor-grab bg-[var(--surface-elevated)]'
            : 'bg-[var(--surface)]',
        ].join(' ')}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <img
            src="/maskot.webp"
            alt="Sain Ai"
            draggable={false}
            className="size-8 md:size-9 shrink-0 object-contain select-none"
          />
          <div className="min-w-0 leading-tight">
            <h2 className="text-[13px] md:text-[13.5px] font-semibold tracking-tight text-[var(--text)] truncate">
              Sain <span className="font-normal text-[var(--text-subtle)]">|</span> Sahabat Interior
            </h2>
            <p
              data-testid="sain-ai-header-subtitle"
              className="text-[10.5px] md:text-[11px] font-light tracking-[0.01em] text-[var(--text-muted)] truncate mt-0.5"
            >
              {isTyping ? 'Sedang mengetik...' : 'By Shansusdzar Indonesia'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0" data-no-drag="true">
          {variant === 'desktop' && onToggleExpand && (
            <button
              type="button"
              data-no-drag="true"
              data-testid="sain-ai-expand"
              onClick={onToggleExpand}
              aria-label={isExpanded ? 'Perkecil jendela chat' : 'Perluas jendela chat'}
              title={isExpanded ? 'Perkecil tampilan' : 'Perluas tampilan'}
              className="inline-flex items-center justify-center size-7 rounded-full text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)] transition-colors cursor-pointer"
            >
              {isExpanded ? (
                <Minimize2 className="size-3.5" aria-hidden="true" />
              ) : (
                <Maximize2 className="size-3.5" aria-hidden="true" />
              )}
            </button>
          )}
          <button
            type="button"
            data-no-drag="true"
            data-testid="sain-ai-reset"
            onClick={() => {
              setRecommendationsOpen(null);
              onResetConversation();
            }}
            aria-label="Mulai percakapan baru"
            title="Percakapan baru"
            className="inline-flex items-center justify-center size-8 md:size-7 rounded-full text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)] transition-colors cursor-pointer"
          >
            <RotateCcw className="size-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            data-no-drag="true"
            data-testid="sain-ai-close"
            onClick={onClose}
            aria-label="Tutup Sain Ai"
            title="Tutup"
            className="inline-flex items-center justify-center size-8 md:size-7 rounded-full text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-muted)] transition-colors cursor-pointer"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Area Percakapan & Rekomendasi Mengambang Transparan */}
      <div className="flex-1 min-h-0 flex flex-col bg-[var(--bg)]">
        <div
          ref={scrollListRef}
          data-testid="sain-ai-messages"
          className="relative app-scroll-region flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-y-contain px-3.5 py-3.5 md:px-4 md:py-4 space-y-4"
        >
          {messages.map((msg, msgIndex) => {
            const isUser = msg.sender === 'user';
            const timeLabel = formatChatTimestamp(msg.createdAt);

            if (isUser) {
              return (
                <div
                  key={msg.id}
                  data-sain-turn-index={msgIndex}
                  data-testid="sain-ai-user-turn"
                  className="flex flex-col items-end gap-1"
                >
                <div
                  data-testid="sain-ai-user-bubble"
                  className="max-w-[84%] px-3.5 py-2.5 rounded-2xl rounded-br-sm bg-[var(--accent)] text-[var(--accent-contrast)] text-[12.5px] md:text-[13px] leading-[1.5] shadow-[var(--shadow-sm)]"
                >
                  <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                  {timeLabel && (
                    <span className="block text-[10px] opacity-70 text-right mt-1 tabular-nums">
                      {timeLabel}
                    </span>
                  )}
                </div>
              </div>
            );
          }

          const routeActions = (msg.actions ?? []).filter((a) => a.kind === 'route' && a.to);
          const whatsappAction = msg.needsDirectContact
            ? (msg.actions ?? []).find((a) => a.kind === 'whatsapp' && a.href)
            : undefined;

          return (
            <article
              key={msg.id}
              data-sain-turn-index={msgIndex}
              data-testid="sain-ai-assistant-turn"
              className="flex flex-col items-start"
            >
              <div className="w-full max-w-[92%] space-y-2.5">
                {/* Gelembung Chat Utama Sain Ai (Tanpa Label "Sain Ai", Jam di Kanan Bawah) */}
                <div
                  data-testid="sain-ai-assistant-bubble"
                  className="w-fit min-w-[140px] max-w-full rounded-2xl rounded-tl-sm border border-[var(--border)] bg-[var(--surface-elevated)] px-3.5 py-2.5 shadow-[var(--shadow-sm)] space-y-2"
                >
                  <p className="text-[12.5px] md:text-[13px] leading-[1.6] text-[var(--text)]">
                    {msg.text}
                  </p>

                  {/* Poin-Poin Penjelasan Ringkas di Dalam Bubble */}
                  {msg.bullets && msg.bullets.length > 0 && (
                    <ul className="pt-1.5 border-t border-[var(--border)] space-y-1 text-[11.5px] md:text-xs text-[var(--text-muted)] leading-relaxed list-disc pl-4">
                      {msg.bullets.map((bullet, idx) => (
                        <li key={idx}>{bullet}</li>
                      ))}
                    </ul>
                  )}

                  {timeLabel && (
                    <div className="flex justify-end pt-0.5">
                      <span
                        data-testid="sain-ai-assistant-time"
                        className="text-[10px] text-[var(--text-subtle)] tabular-nums"
                      >
                        {timeLabel}
                      </span>
                    </div>
                  )}
                </div>

                {/* Grid Awal yang Rapi Saat Percakapan Baru Dimulai */}
                {isInitialEmptyThread && msgIndex === 0 && (
                  <div
                    data-testid="sain-ai-starter-grid"
                    className="grid grid-cols-2 gap-2"
                  >
                    {WELCOME_STARTER_CARDS.map((card) => {
                      const Icon = card.icon;
                      return (
                        <button
                          key={card.id}
                          type="button"
                          disabled={isTyping}
                          onClick={() => {
                            if (!isTyping) onSendMessage(card.prompt);
                          }}
                          className="group p-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-left cursor-pointer flex flex-col gap-1.5"
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <Icon
                              className="size-4 text-[var(--text-muted)] group-hover:text-[var(--text)] transition-colors shrink-0"
                              aria-hidden="true"
                            />
                            <ArrowUpRight
                              className="size-3 text-[var(--text-subtle)] opacity-70 group-hover:opacity-100 transition-opacity shrink-0"
                              aria-hidden="true"
                            />
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-[var(--text)] leading-snug">
                              {card.title}
                            </p>
                            <p className="text-[11px] text-[var(--text-muted)] leading-snug mt-0.5 line-clamp-2">
                              {card.subtitle}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Kartu Kalkulasi Estimasi */}
                {msg.estimate && (
                  <div
                    data-testid="sain-ai-estimate-card"
                    className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] overflow-hidden"
                  >
                    <div className="p-3.5 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[11px] text-[var(--text-muted)]">
                            {msg.estimate.dimensionLabel} · {msg.estimate.measureLabel}
                          </p>
                          <p className="text-xs font-semibold text-[var(--text)] truncate mt-0.5">
                            {msg.estimate.productName}
                          </p>
                        </div>
                        {msg.estimate.promoLabel && (
                          <span className="text-[11px] font-semibold text-red-600 dark:text-red-400 shrink-0">
                            {msg.estimate.promoLabel}
                          </span>
                        )}
                      </div>

                      <div className="flex items-baseline gap-2">
                        <span className="text-lg font-bold tracking-tight text-[var(--text)] tabular-nums">
                          {msg.estimate.totalEstimateFormatted}
                        </span>
                        {msg.estimate.compareAtFormatted && (
                          <span className="text-xs text-[var(--text-subtle)] line-through tabular-nums">
                            {msg.estimate.compareAtFormatted}
                          </span>
                        )}
                      </div>

                      <div className="pt-2.5 border-t border-[var(--border)] grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                        <span className="text-[var(--text-muted)]">Bahan &amp; Lapis</span>
                        <span className="text-right font-medium text-[var(--text)]">
                          {msg.estimate.materialLabel} · {msg.estimate.finishLabel}
                        </span>
                        <span className="text-[var(--text-muted)]">Tarif Acuan</span>
                        <span className="text-right font-medium text-[var(--text)] tabular-nums">
                          {msg.estimate.unitRateLabel}
                        </span>
                      </div>
                    </div>

                    {msg.estimate.paymentStages.length > 0 && (
                      <div className="px-3.5 py-2.5 border-t border-[var(--border)] bg-[var(--surface)] space-y-2">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-[var(--text)]">
                            Simulasi 4 Termin Pembayaran
                          </span>
                          <span className="text-[var(--text-subtle)] tabular-nums">
                            30 / 40 / 20 / 10%
                          </span>
                        </div>
                        <div className="space-y-1 text-[11px] tabular-nums">
                          {msg.estimate.paymentStages.map((stage) => (
                            <div
                              key={stage.nama}
                              className="flex items-center justify-between gap-2"
                            >
                              <span className="text-[var(--text-muted)] truncate">
                                {stage.nama} ({stage.persentase}%)
                              </span>
                              <span className="font-medium text-[var(--text)] shrink-0">
                                {stage.amountFormatted}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Tabel Perbandingan Material / Finishing */}
                {msg.comparison && (
                  <div
                    data-testid="sain-ai-comparison-table"
                    className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] p-3 space-y-3"
                  >
                    <p className="text-xs font-semibold text-[var(--text)]">
                      {msg.comparison.judul}
                    </p>
                    <div className="space-y-2.5">
                      {msg.comparison.columns.map((col) => (
                        <div
                          key={col.id}
                          className="pt-2.5 border-t border-[var(--border)] first:pt-0 first:border-t-0 space-y-1.5"
                        >
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="text-xs font-semibold text-[var(--text)]">
                              {col.nama}
                            </span>
                            <span className="text-[10.5px] text-[var(--text-subtle)]">
                              {col.sublabel}
                            </span>
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-[10.5px] tabular-nums">
                            {col.metrics.map((metric) => (
                              <div key={metric.label} className="space-y-1">
                                <div className="flex items-center justify-between gap-1 text-[var(--text-muted)]">
                                  <span className="truncate">{metric.label}</span>
                                  <span className="font-semibold text-[var(--text)]">
                                    {metric.score}
                                  </span>
                                </div>
                                <div className="h-1 rounded-full bg-[var(--surface-muted)] overflow-hidden">
                                  <div
                                    style={{ width: `${Math.min(100, Math.max(0, metric.score))}%` }}
                                    className="h-full rounded-full bg-[var(--accent)]"
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                          {col.cocokUntuk && (
                            <p className="text-[11px] text-[var(--text-muted)]">
                              Ideal: {col.cocokUntuk}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="pt-2 border-t border-[var(--border)] text-[11px] text-[var(--text-muted)] leading-relaxed">
                      {msg.comparison.ringkasanRekomendasi}
                    </p>
                  </div>
                )}

                {/* Linimasa Tahapan Kerja / Termin */}
                {msg.steps && msg.steps.length > 0 && (
                  <ol
                    data-testid="sain-ai-step-timeline"
                    className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-elevated)] divide-y divide-[var(--border)]"
                  >
                    {msg.steps.map((step) => (
                      <li key={step.nomor} className="p-2.5 flex items-start gap-2.5 text-xs">
                        <span className="font-mono text-[11px] font-semibold text-[var(--text-subtle)] tabular-nums pt-0.5 shrink-0">
                          {step.nomor}
                        </span>
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-semibold text-[var(--text)] truncate">
                              {step.judul}
                            </span>
                            {step.badge && (
                              <span className="text-[11px] font-medium text-[var(--text-muted)] tabular-nums shrink-0">
                                {step.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[var(--text-muted)] leading-snug">
                            {step.deskripsi}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}

                {/* Kartu Spesifikasi Material (Saat Tidak Menampilkan Matriks) */}
                {!msg.comparison && msg.materials && msg.materials.length > 0 && (
                  <div className="space-y-2">
                    {msg.materials.map((mat) => (
                      <div
                        key={mat.id}
                        className="p-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] space-y-1.5 text-xs"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-[var(--text)]">{mat.nama}</span>
                          <span className="text-[11px] text-[var(--text-muted)]">
                            {mat.kategori === 'papan' ? 'Bahan Papan 18 mm' : 'Finishing'}
                          </span>
                        </div>
                        <p className="text-[11px] text-[var(--text-muted)] leading-snug">
                          {mat.ringkasan}
                        </p>
                        <div className="grid grid-cols-3 gap-2 pt-1 text-[10.5px] tabular-nums">
                          <div>
                            <span className="block text-[var(--text-subtle)]">Tahan Lembap</span>
                            <span className="font-semibold text-[var(--text)]">
                              {mat.ketahananLembap}/100
                            </span>
                          </div>
                          <div>
                            <span className="block text-[var(--text-subtle)]">Keawetan</span>
                            <span className="font-semibold text-[var(--text)]">
                              {mat.peringkatKeawetan}/100
                            </span>
                          </div>
                          <div>
                            <span className="block text-[var(--text-subtle)]">Ekonomis</span>
                            <span className="font-semibold text-[var(--text)]">
                              {mat.keterjangkauan}/100
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Kartu Produk Terkait */}
                {msg.products && msg.products.length > 0 && (
                  <div className="space-y-1.5">
                    {msg.products.map((prod) => (
                      <Link
                        key={prod.id}
                        to={prod.to}
                        onClick={onClose}
                        className="flex items-center gap-2.5 p-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] hover:border-[var(--border-strong)] hover:-translate-y-px transition-[border-color,transform] duration-150"
                      >
                        <MediaThumbWithFallback src={prod.gambar} alt={prod.nama} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-[var(--text)] truncate">
                              {prod.nama}
                            </p>
                            {prod.promoLabel && (
                              <span className="text-[10.5px] font-semibold text-red-600 dark:text-red-400 shrink-0">
                                {prod.promoLabel}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[var(--text-muted)] truncate tabular-nums">
                            {prod.startingPriceLabel} · {prod.unitLabel}
                          </p>
                        </div>
                        <ArrowUpRight
                          className="size-3.5 text-[var(--text-muted)] shrink-0"
                          aria-hidden="true"
                        />
                      </Link>
                    ))}
                  </div>
                )}

                {/* Kartu Portofolio */}
                {msg.portfolios && msg.portfolios.length > 0 && (
                  <div className="space-y-1.5">
                    {msg.portfolios.map((proj) => (
                      <Link
                        key={proj.id}
                        to={proj.to}
                        onClick={onClose}
                        className="flex items-center gap-2.5 p-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] hover:border-[var(--border-strong)] hover:-translate-y-px transition-[border-color,transform] duration-150"
                      >
                        <MediaThumbWithFallback src={proj.gambar} alt={proj.judul} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-[var(--text)] truncate">
                            {proj.judul}
                          </p>
                          <p className="text-[11px] text-[var(--text-muted)] truncate">
                            {proj.lokasi} · {proj.dimensi} · {proj.durasi}
                          </p>
                        </div>
                        <ArrowUpRight
                          className="size-3.5 text-[var(--text-muted)] shrink-0"
                          aria-hidden="true"
                        />
                      </Link>
                    ))}
                  </div>
                )}

                {/* Palet Warna Interaktif */}
                {msg.colors && msg.colors.length > 0 && (
                  <div
                    data-testid="sain-ai-color-grid"
                    className="grid grid-cols-2 gap-1.5"
                  >
                    {msg.colors.map((color) => (
                      <button
                        key={color.id}
                        type="button"
                        disabled={isTyping}
                        onClick={() => {
                          if (!isTyping) {
                            onSendMessage(
                              `Estimasi lemari pakaian warna ${color.nama} pakai Cat Duco`
                            );
                          }
                        }}
                        className="flex items-center gap-2 p-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] hover:border-[var(--border-strong)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-w-0 text-left cursor-pointer"
                      >
                        <span
                          aria-hidden="true"
                          style={{ backgroundColor: color.hex }}
                          className="size-5 rounded-full border border-[var(--border-strong)] shrink-0"
                        />
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold text-[var(--text)] truncate">
                            {color.nama}
                          </p>
                          <p className="text-[10px] text-[var(--text-muted)] truncate">
                            {color.catatanNuansa}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Eskalasi Kontak Langsung — Hanya muncul ketika data/logika tidak mencukupi */}
                {msg.needsDirectContact && whatsappAction?.href && (
                  <div
                    data-testid="sain-ai-direct-contact"
                    className="rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface-elevated)] p-3 space-y-2"
                  >
                    {msg.directContactReason && (
                      <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">
                        {msg.directContactReason}
                      </p>
                    )}
                    <a
                      href={whatsappAction.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-2 w-full min-h-9 px-3 py-1.5 rounded-[var(--radius-md)] bg-[var(--accent)] text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)] text-xs font-semibold transition-colors"
                    >
                      <MessageCircle className="size-3.5 shrink-0" aria-hidden="true" />
                      <span>{whatsappAction.label}</span>
                    </a>
                  </div>
                )}

                {/* Tautan Aksi Navigasi Dalam Aplikasi */}
                {routeActions.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {routeActions.map((act) => (
                      <Link
                        key={act.label}
                        to={act.to!}
                        onClick={onClose}
                        className="inline-flex items-center gap-1 min-h-8 px-2.5 py-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--text)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)] text-[11px] font-medium whitespace-nowrap transition-colors"
                      >
                        <span>{act.label}</span>
                        <ArrowUpRight className="size-3 shrink-0" aria-hidden="true" />
                      </Link>
                    ))}
                  </div>
                )}

              </div>
            </article>
          );
        })}

        {/* Bubble Loading / Mengetik (...) saat Sain Ai memproses jawaban */}
        {isTyping && (
          <div
            role="status"
            aria-label="Sain Ai sedang mengetik..."
            data-testid="sain-ai-typing-bubble"
            className="flex items-start"
          >
            <div className="inline-flex items-center gap-1.5 px-4 py-3 rounded-2xl rounded-tl-sm border border-[var(--border)] bg-[var(--surface-elevated)] shadow-[var(--shadow-sm)]">
              <span
                aria-hidden="true"
                className="sain-typing-dot size-1.5 rounded-full bg-[var(--text-muted)]"
              />
              <span
                aria-hidden="true"
                className="sain-typing-dot sain-typing-dot-2 size-1.5 rounded-full bg-[var(--text-muted)]"
              />
              <span
                aria-hidden="true"
                className="sain-typing-dot sain-typing-dot-3 size-1.5 rounded-full bg-[var(--text-muted)]"
              />
              <span className="sr-only">Sain Ai sedang mengetik...</span>
            </div>
          </div>
        )}
        </div>

        {/* Rekomendasi Pertanyaan Dinamis (Hilang Saat AI Mengetik, Kembali Muncul Setelah Selesai) */}
        {!isTyping && isRecommendationsVisible && (
          <div
            data-testid="sain-ai-recommendations"
            data-recommendations-state="ready"
            className="shrink-0 bg-transparent px-3.5 pb-2 pt-1 md:px-4"
          >
            <div className="flex items-center gap-1.5 overflow-x-auto bg-transparent">
              {activeRecommendations.map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => onSendMessage(chip.prompt)}
                  className="shrink-0 min-h-7 px-2.5 py-1 rounded-[var(--radius-md)] border border-[#3f3f46] bg-[#27272a] hover:bg-[#18181b] text-[11px] font-medium text-[#e4e4e7] hover:text-white dark:border-[var(--border-strong)] dark:bg-[var(--surface-elevated)] dark:hover:bg-[var(--surface-muted)] dark:text-[#d6d0c7] dark:hover:text-[#f2f0ec] shadow-[var(--shadow-sm)] transition-colors whitespace-nowrap cursor-pointer"
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Composer Chat Minimalis + Ikon Lampu Rekomendasi di Kiri (Terkunci & Ikon Lampu Hilang Saat AI Mengetik) */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitPrompt();
        }}
        className={[
          'shrink-0 px-3 py-2 md:px-3.5 md:py-2 border-t border-[var(--border)] bg-[var(--surface)]',
          variant === 'mobile' ? 'pb-[max(0.5rem,env(safe-area-inset-bottom))]' : '',
        ].join(' ')}
      >
        <div className="flex items-end gap-2">
          {!isTyping && (
            <button
              type="button"
              onClick={() => setRecommendationsOpen(!isRecommendationsVisible)}
              aria-label={
                isRecommendationsVisible
                  ? 'Sembunyikan rekomendasi pertanyaan'
                  : 'Tampilkan rekomendasi pertanyaan'
              }
              aria-pressed={isRecommendationsVisible}
              title={
                isRecommendationsVisible
                  ? 'Sembunyikan rekomendasi pertanyaan'
                  : 'Tampilkan rekomendasi pertanyaan'
              }
              data-testid="sain-ai-toggle-recommendations"
              className={[
                'inline-flex items-center justify-center size-9 rounded-full border transition-colors cursor-pointer shrink-0',
                isRecommendationsVisible
                  ? 'border-[var(--border-strong)] bg-[var(--accent)] text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)]'
                  : 'border-[var(--border)] bg-[var(--bg)] text-[var(--text-muted)] hover:text-[var(--text)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)]',
              ].join(' ')}
            >
              <Lightbulb className="size-4" aria-hidden="true" />
            </button>
          )}

          <div
            className={[
              'flex-1 min-w-0 flex items-end gap-1.5 rounded-[20px] border border-[var(--border)] bg-[var(--bg)] pl-3.5 pr-1 py-1 transition-colors',
              isTyping ? 'opacity-65 cursor-not-allowed' : 'focus-within:border-[var(--border-strong)]',
            ].join(' ')}
          >
            <div className="relative flex-1 min-w-0 flex items-end">
              <textarea
                ref={textareaRef}
                rows={1}
                value={draft}
                disabled={isTyping}
                onChange={(event) => {
                  setDraft(event.target.value);
                  adjustTextareaHeight();
                }}
                onKeyDown={handleKeyDown}
                placeholder={
                  isTyping
                    ? 'Menunggu respon Sain Ai selesai...'
                    : 'Ketik pertanyaan interior Anda...'
                }
                aria-label="Ketik pertanyaan untuk Sain Ai"
                data-testid="sain-ai-input"
                className="app-scroll-region block w-full max-h-20 py-[5px] pr-3 bg-transparent resize-none text-[12.5px] md:text-[13px] font-normal tracking-[-0.005em] leading-[1.45] text-[var(--text)] placeholder:text-[12px] md:placeholder:text-[12.5px] placeholder:font-normal placeholder:text-[var(--text-subtle)] disabled:cursor-not-allowed"
              />
              <TextareaScrollIndicator
                targetRef={textareaRef}
                value={draft}
                topInsetClass="top-1.5"
                bottomInsetClass="bottom-1.5"
                rightInsetClass="right-0"
                minThumbHeight={18}
              />
            </div>
            <button
              type="submit"
              disabled={isTyping || draft.trim().length === 0}
              aria-label="Kirim pertanyaan"
              data-testid="sain-ai-send"
              className="inline-flex items-center justify-center size-7 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)] disabled:opacity-35 disabled:cursor-not-allowed transition-colors cursor-pointer shrink-0"
            >
              <SendHorizontal className="size-3.5 translate-x-[0.5px]" aria-hidden="true" />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
