import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Headset } from 'lucide-react';
import { motion } from 'motion/react';
import { Container } from '../../components/layout/container';
import { ExternalLinkButton, LinkButton } from '../../components/ui/button';
import {
  buildResponseSignature,
  isMediaResponseChanged,
  useCachedMediaSrc,
} from '../../lib/media-cache';
import { buildDynamicWhatsAppUrl, useSiteContentStore } from '../../store/site-content-store';
import { HERO_MEDIA } from './utils';

const HERO_VIDEO_CACHE_NAME = 'shansusdzar-hero-media-v2';
let cachedHeroVideoObjectUrl: string | null = null;
let cachedHeroVideoSignature = '';
let pendingHeroVideoLoad: Promise<string | null> | null = null;
let hasRevalidatedHeroVideo = false;
const heroVideoListeners = new Set<(url: string) => void>();

async function revalidateHeroVideoInBackground(
  cache: Cache | null,
  previousSignature: string,
  previousSize: number
): Promise<void> {
  if (hasRevalidatedHeroVideo) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  hasRevalidatedHeroVideo = true;

  try {
    const headRes = await fetch(HERO_MEDIA.sumberVideo, { method: 'HEAD', cache: 'no-cache' }).catch(
      () => null
    );
    if (headRes && headRes.ok) {
      const headType = headRes.headers.get('Content-Type') ?? '';
      if (!headType.includes('text/html')) {
        const changed = isMediaResponseChanged(previousSignature, previousSize, headRes.headers);
        if (!changed && buildResponseSignature(headRes.headers)) {
          return;
        }
      }
    }

    const freshRes = await fetch(HERO_MEDIA.sumberVideo, { cache: 'no-cache' });
    const contentType = freshRes.headers.get('Content-Type') ?? '';
    if (!freshRes.ok || contentType.includes('text/html')) return;

    const freshBlob = await freshRes.blob();
    if (freshBlob.size === 0) return;

    const changed = isMediaResponseChanged(
      previousSignature,
      previousSize,
      freshRes.headers,
      freshBlob.size
    );
    if (!changed && previousSignature) return;

    const normalizedBlob = freshBlob.type.startsWith('video/')
      ? freshBlob
      : new Blob([freshBlob], { type: 'video/webm' });

    if (cache) {
      try {
        await cache.delete(HERO_MEDIA.sumberVideo);
        const headers = new Headers(freshRes.headers);
        headers.set('Content-Type', normalizedBlob.type || 'video/webm');
        if (!headers.get('Content-Length')) {
          headers.set('Content-Length', String(normalizedBlob.size));
        }
        await cache.put(HERO_MEDIA.sumberVideo, new Response(normalizedBlob, { status: 200, headers }));
      } catch {
        // Ignore storage write errors
      }
    }

    const nextObjectUrl = URL.createObjectURL(normalizedBlob);
    const prevUrl = cachedHeroVideoObjectUrl;
    cachedHeroVideoObjectUrl = nextObjectUrl;
    cachedHeroVideoSignature = buildResponseSignature(freshRes.headers);

    for (const listener of heroVideoListeners) {
      listener(nextObjectUrl);
    }

    if (prevUrl && prevUrl !== nextObjectUrl) {
      window.setTimeout(() => {
        try {
          URL.revokeObjectURL(prevUrl);
        } catch {
          // Ignore already revoked URLs
        }
      }, 3000);
    }
  } catch {
    // Offline or transient network error; retain cached video
  }
}

async function loadFullHeroVideo(): Promise<string | null> {
  if (cachedHeroVideoObjectUrl) {
    return cachedHeroVideoObjectUrl;
  }

  if (pendingHeroVideoLoad) {
    return pendingHeroVideoLoad;
  }

  pendingHeroVideoLoad = (async () => {
    try {
      let videoBlob: Blob | null = null;
      let cache: Cache | null = null;

      if (typeof window !== 'undefined' && 'caches' in window) {
        try {
          cache = await window.caches.open(HERO_VIDEO_CACHE_NAME);
          const cachedResponse = await cache.match(HERO_MEDIA.sumberVideo);
          const cachedType = cachedResponse?.headers.get('Content-Type') ?? '';
          if (cachedResponse && cachedResponse.ok && !cachedType.includes('text/html')) {
            const candidate = await cachedResponse.blob();
            if (candidate.size > 0) {
              videoBlob = candidate;
              cachedHeroVideoSignature = buildResponseSignature(cachedResponse.headers);
              void revalidateHeroVideoInBackground(cache, cachedHeroVideoSignature, candidate.size);
            }
          }
        } catch {
          // Ignore Cache Storage restrictions and fall back to network fetch
        }
      }

      if (!videoBlob) {
        hasRevalidatedHeroVideo = true;
        const response = await fetch(HERO_MEDIA.sumberVideo, { cache: 'no-cache' });
        const contentType = response.headers.get('Content-Type') ?? '';
        if (!response.ok || contentType.includes('text/html')) {
          return null;
        }

        const fetchedBlob = await response.blob();
        if (fetchedBlob.size === 0) {
          return null;
        }

        videoBlob = fetchedBlob.type.startsWith('video/')
          ? fetchedBlob
          : new Blob([fetchedBlob], { type: 'video/webm' });

        cachedHeroVideoSignature = buildResponseSignature(response.headers);

        if (cache) {
          try {
            await cache.delete(HERO_MEDIA.sumberVideo);
            const headers = new Headers(response.headers);
            headers.set('Content-Type', videoBlob.type || 'video/webm');
            if (!headers.get('Content-Length')) {
              headers.set('Content-Length', String(videoBlob.size));
            }
            await cache.put(HERO_MEDIA.sumberVideo, new Response(videoBlob, { status: 200, headers }));
          } catch {
            // Ignore Cache Storage write failures (e.g. quota exceeded)
          }
        }
      }

      if (!videoBlob || videoBlob.size === 0) {
        return null;
      }

      const normalizedBlob = videoBlob.type.startsWith('video/')
        ? videoBlob
        : new Blob([videoBlob], { type: 'video/webm' });

      const objectUrl = URL.createObjectURL(normalizedBlob);
      cachedHeroVideoObjectUrl = objectUrl;
      return objectUrl;
    } catch {
      return null;
    } finally {
      pendingHeroVideoLoad = null;
    }
  })();

  return pendingHeroVideoLoad;
}

export function SectionHero() {
  const beranda = useSiteContentStore((state) => state.beranda);
  const businessConfig = useSiteContentStore((state) => state.businessConfig);
  const surveyWhatsappUrl = buildDynamicWhatsAppUrl(
    businessConfig,
    `Halo ${businessConfig.namaMerek}, saya ingin bertanya apakah bisa dilakukan survei pengukuran hari ini?`
  );
  const heroPosterSrc = useCachedMediaSrc(HERO_MEDIA.sumberGambar) ?? HERO_MEDIA.sumberGambar;
  const [videoObjectUrl, setVideoObjectUrl] = useState<string | null>(cachedHeroVideoObjectUrl);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const navWithConnection = navigator as Navigator & {
      connection?: { saveData?: boolean };
    };
    const saveDataEnabled = Boolean(navWithConnection.connection?.saveData);
    if (prefersReducedMotion || saveDataEnabled) return;

    let isActive = true;
    const handleUpdatedVideo = (nextUrl: string) => {
      if (isActive) {
        setVideoObjectUrl(nextUrl);
      }
    };
    heroVideoListeners.add(handleUpdatedVideo);

    if (cachedHeroVideoObjectUrl) {
      setVideoObjectUrl(cachedHeroVideoObjectUrl);
    } else {
      void loadFullHeroVideo().then((url) => {
        if (isActive && url) {
          setVideoObjectUrl(url);
        }
      });
    }

    return () => {
      isActive = false;
      heroVideoListeners.delete(handleUpdatedVideo);
    };
  }, []);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoObjectUrl || !videoEl) return;

    let isCancelled = false;
    videoEl.defaultMuted = true;
    videoEl.muted = true;
    videoEl.playsInline = true;

    const tryPlay = () => {
      if (isCancelled) return;
      const el = videoRef.current;
      if (!el) return;
      el.defaultMuted = true;
      el.muted = true;

      const playPromise = el.play();
      if (playPromise && typeof playPromise.then === 'function') {
        playPromise
          .then(() => {
            if (!isCancelled) {
              setIsVideoReady(true);
            }
          })
          .catch(() => {
            // Will retry on media ready / visibility / first interaction
          });
      } else if (!el.paused) {
        setIsVideoReady(true);
      }
    };

    tryPlay();

    const handleVisibilityOrGesture = () => {
      if (document.visibilityState === 'hidden') return;
      tryPlay();
    };

    document.addEventListener('visibilitychange', handleVisibilityOrGesture);
    window.addEventListener('pointerdown', handleVisibilityOrGesture, { once: true, passive: true });
    window.addEventListener('touchstart', handleVisibilityOrGesture, { once: true, passive: true });

    return () => {
      isCancelled = true;
      document.removeEventListener('visibilitychange', handleVisibilityOrGesture);
      window.removeEventListener('pointerdown', handleVisibilityOrGesture);
      window.removeEventListener('touchstart', handleVisibilityOrGesture);
    };
  }, [videoObjectUrl]);

  const handleVideoPlayTrigger = () => {
    const el = videoRef.current;
    if (!el) return;
    el.defaultMuted = true;
    el.muted = true;
    if (el.paused) {
      el.play()
        .then(() => setIsVideoReady(true))
        .catch(() => {});
    } else {
      setIsVideoReady(true);
    }
  };

  return (
    <section aria-labelledby="beranda-hero-heading">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="relative left-1/2 -translate-x-1/2 w-screen -mt-5 sm:-mt-9 aspect-[4/3] sm:aspect-[16/9] lg:aspect-[3/1] overflow-hidden rounded-none bg-[var(--bg)]"
      >
        <img
          src={heroPosterSrc}
          alt=""
          aria-hidden="true"
          loading="eager"
          decoding="async"
          fetchPriority="high"
          className="pointer-events-none absolute inset-0 size-full object-cover lg:object-bottom"
        />

        {videoObjectUrl && (
          <video
            ref={videoRef}
            src={videoObjectUrl}
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            aria-hidden="true"
            onLoadedData={handleVideoPlayTrigger}
            onCanPlay={handleVideoPlayTrigger}
            onCanPlayThrough={handleVideoPlayTrigger}
            onPlaying={() => setIsVideoReady(true)}
            className={[
              'pointer-events-none absolute inset-0 size-full object-cover lg:object-bottom transition-opacity duration-500',
              isVideoReady ? 'opacity-100' : 'opacity-0',
            ].join(' ')}
          />
        )}

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[48%] sm:h-[42%] lg:h-[36%] bg-gradient-to-t from-[var(--bg)] via-[var(--bg)]/75 to-transparent"
        />

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-l from-transparent via-[var(--bg)]/55 to-[var(--bg)]/95"
        />

        <Container className="relative z-10 flex h-full min-h-0 flex-col justify-center pt-3 pb-10 sm:pt-6 sm:pb-14 lg:py-8">
          <div className="space-y-3 sm:space-y-4 max-w-xl">
            <div className="space-y-1 sm:space-y-1.5">
              <p className="text-sm sm:text-base font-medium text-[var(--text-muted)] leading-snug">
                {beranda.labelHero}
              </p>
              <h1
                id="beranda-hero-heading"
                className="text-3xl sm:text-4xl lg:text-[2.75rem] font-semibold tracking-tight text-[var(--text)] leading-[1.04]"
              >
                <span className="block">{beranda.judulHero}</span>
                <span className="block">{beranda.judulHeroBarisDua}</span>
              </h1>
              <p className="text-sm sm:text-base text-[var(--text-muted)] leading-snug pt-0.5">
                <span className="block">{beranda.deskripsiHero}</span>
                <span className="block">{beranda.deskripsiHeroBarisDua}</span>
              </p>
            </div>
            <div
              aria-label="Aksi cepat beranda"
              className="hidden lg:flex flex-wrap items-center gap-2.5 pt-1"
            >
              <LinkButton
                to="/produk"
                variant="primary"
                size="sm"
                className="min-h-9 px-3.5 py-1.5 text-xs"
              >
                Lihat Produk
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </LinkButton>
              <ExternalLinkButton
                href={surveyWhatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                variant="secondary"
                size="sm"
                className="min-h-9 px-3.5 py-1.5 text-xs"
              >
                <Headset className="size-3.5" aria-hidden="true" />
                Minta Survei
              </ExternalLinkButton>
            </div>
          </div>
        </Container>
      </motion.div>
    </section>
  );
}
