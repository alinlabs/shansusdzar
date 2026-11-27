import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Headset } from 'lucide-react';
import { Container } from '../../components/layout/container';
import { Button, LinkButton } from '../../components/ui/button';
import { getDeviceCapabilities } from '../../lib/device-capabilities';
import {
  buildResponseSignature,
  isMediaResponseChanged,
  useCachedMediaSrc,
} from '../../lib/media-cache';
import { prefetchRoute } from '../../lib/route-prefetch';
import { useSiteContentStore } from '../../store/site-content-store';
import { useUserProfileStore } from '../../store/user-profile-store';
import { HERO_MEDIA } from './utils';

const HERO_VIDEO_CACHE_NAME = 'shansusdzar-hero-media-v2';
const HERO_REVALIDATE_STORAGE_KEY = 'shansusdzar-hero-video-rev-at';
const HERO_REVALIDATE_INTERVAL_MS = 12 * 60 * 60 * 1000;

let cachedHeroVideoObjectUrl: string | null = null;
let cachedHeroVideoSignature = '';
let pendingHeroVideoLoad: Promise<string | null> | null = null;
let hasRevalidatedHeroVideo = false;
const heroVideoListeners = new Set<(url: string) => void>();

function shouldSkipHeroVideoRevalidation(): boolean {
  if (hasRevalidatedHeroVideo) return true;
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(HERO_REVALIDATE_STORAGE_KEY);
    if (!raw) return false;
    const timestamp = Number(raw);
    return Number.isFinite(timestamp) && Date.now() - timestamp < HERO_REVALIDATE_INTERVAL_MS;
  } catch {
    return false;
  }
}

function markHeroVideoRevalidated(): void {
  hasRevalidatedHeroVideo = true;
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(HERO_REVALIDATE_STORAGE_KEY, String(Date.now()));
  } catch {
    // Ignore storage quota errors
  }
}

async function revalidateHeroVideoInBackground(
  cache: Cache | null,
  previousSignature: string,
  previousSize: number
): Promise<void> {
  if (shouldSkipHeroVideoRevalidation()) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;
  if (getDeviceCapabilities().isConstrainedNetwork) return;
  markHeroVideoRevalidated();

  try {
    const headRes = await fetch(HERO_MEDIA.sumberVideo, { method: 'HEAD', cache: 'no-cache' }).catch(
      () => null
    );
    if (headRes && headRes.ok) {
      const headType = headRes.headers.get('Content-Type') ?? '';
      if (!headType.includes('text/html')) {
        const changed = isMediaResponseChanged(previousSignature, previousSize, headRes.headers);
        if (!changed) {
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
    if (!changed) return;

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

async function readCachedHeroVideoOnly(): Promise<string | null> {
  if (cachedHeroVideoObjectUrl) {
    return cachedHeroVideoObjectUrl;
  }
  if (typeof window === 'undefined' || !('caches' in window)) {
    return null;
  }
  try {
    const cache = await window.caches.open(HERO_VIDEO_CACHE_NAME);
    const cachedResponse = await cache.match(HERO_MEDIA.sumberVideo);
    const cachedType = cachedResponse?.headers.get('Content-Type') ?? '';
    if (cachedResponse && cachedResponse.ok && !cachedType.includes('text/html')) {
      const candidate = await cachedResponse.blob();
      if (candidate.size > 0) {
        cachedHeroVideoSignature = buildResponseSignature(cachedResponse.headers);
        const normalizedBlob = candidate.type.startsWith('video/')
          ? candidate
          : new Blob([candidate], { type: 'video/webm' });
        const objectUrl = URL.createObjectURL(normalizedBlob);
        cachedHeroVideoObjectUrl = objectUrl;
        void revalidateHeroVideoInBackground(cache, cachedHeroVideoSignature, candidate.size);
        return objectUrl;
      }
    }
  } catch {
    // Ignore cache read failures
  }
  return null;
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
      const fromCache = await readCachedHeroVideoOnly();
      if (fromCache) {
        return fromCache;
      }

      let cache: Cache | null = null;
      if (typeof window !== 'undefined' && 'caches' in window) {
        cache = await window.caches.open(HERO_VIDEO_CACHE_NAME).catch(() => null);
      }

      markHeroVideoRevalidated();
      const response = await fetch(HERO_MEDIA.sumberVideo, { cache: 'default' });
      const contentType = response.headers.get('Content-Type') ?? '';
      if (!response.ok || contentType.includes('text/html')) {
        return null;
      }

      const fetchedBlob = await response.blob();
      if (fetchedBlob.size === 0) {
        return null;
      }

      const videoBlob = fetchedBlob.type.startsWith('video/')
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

      const objectUrl = URL.createObjectURL(videoBlob);
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
  const requestSurvey = useUserProfileStore((state) => state.requestSurvey);
  const heroPosterSrc = useCachedMediaSrc(HERO_MEDIA.sumberGambar) ?? HERO_MEDIA.sumberGambar;
  const [videoObjectUrl, setVideoObjectUrl] = useState<string | null>(cachedHeroVideoObjectUrl);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const heroContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const isHeroInViewportRef = useRef(true);

  const handleRequestSurvey = () => {
    requestSurvey({
      surveyActivityNote: 'Mengajukan request survei lokasi dari Beranda',
    });
  };

  useEffect(() => {
    const capabilities = getDeviceCapabilities();
    if (!capabilities.shouldAutoLoadHeroVideo) return;

    let isActive = true;
    let idleHandle: number | null = null;
    let timeoutHandle: number | null = null;

    const handleUpdatedVideo = (nextUrl: string) => {
      if (isActive) {
        setVideoObjectUrl(nextUrl);
      }
    };
    heroVideoListeners.add(handleUpdatedVideo);

    const applyVideoUrl = (url: string | null) => {
      if (isActive && url) {
        setVideoObjectUrl(url);
      }
    };

    if (cachedHeroVideoObjectUrl) {
      setVideoObjectUrl(cachedHeroVideoObjectUrl);
    } else {
      // Serve immediately if cached in CacheStorage; otherwise defer network download
      // until after initial hero poster paint and idle so LCP & navigation stay crisp.
      void readCachedHeroVideoOnly().then((cachedUrl) => {
        if (!isActive) return;
        if (cachedUrl) {
          setVideoObjectUrl(cachedUrl);
          return;
        }

        const startDeferredNetworkFetch = () => {
          if (!isActive) return;
          void loadFullHeroVideo().then(applyVideoUrl);
        };

        if ('requestIdleCallback' in window && typeof window.requestIdleCallback === 'function') {
          idleHandle = window.requestIdleCallback(startDeferredNetworkFetch, { timeout: 1200 });
        } else {
          timeoutHandle = window.setTimeout(startDeferredNetworkFetch, 350);
        }
      });
    }

    return () => {
      isActive = false;
      heroVideoListeners.delete(handleUpdatedVideo);
      if (idleHandle !== null && 'cancelIdleCallback' in window) {
        window.cancelIdleCallback(idleHandle);
      }
      if (timeoutHandle !== null) {
        window.clearTimeout(timeoutHandle);
      }
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
      if (isCancelled || !isHeroInViewportRef.current || document.visibilityState === 'hidden') return;
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

    let observer: IntersectionObserver | null = null;
    const containerEl = heroContainerRef.current;
    if (containerEl && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (!entry) return;
          const visible = entry.isIntersecting || entry.intersectionRatio > 0;
          isHeroInViewportRef.current = visible;
          if (!visible) {
            if (!videoEl.paused) {
              videoEl.pause();
            }
          } else {
            tryPlay();
          }
        },
        { threshold: 0.05 }
      );
      observer.observe(containerEl);
    }

    const handleVisibilityOrGesture = () => {
      if (document.visibilityState === 'hidden') {
        if (!videoEl.paused) {
          videoEl.pause();
        }
        return;
      }
      tryPlay();
    };

    document.addEventListener('visibilitychange', handleVisibilityOrGesture);
    window.addEventListener('pointerdown', handleVisibilityOrGesture, { once: true, passive: true });
    window.addEventListener('touchstart', handleVisibilityOrGesture, { once: true, passive: true });

    return () => {
      isCancelled = true;
      observer?.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityOrGesture);
      window.removeEventListener('pointerdown', handleVisibilityOrGesture);
      window.removeEventListener('touchstart', handleVisibilityOrGesture);
    };
  }, [videoObjectUrl]);

  const handleVideoPlayTrigger = () => {
    const el = videoRef.current;
    if (!el || !isHeroInViewportRef.current || document.visibilityState === 'hidden') return;
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
      <div
        ref={heroContainerRef}
        className="hero-enter-motion relative left-1/2 -translate-x-1/2 w-screen -mt-5 sm:-mt-9 aspect-[4/3] sm:aspect-[16/9] lg:aspect-[3/1] overflow-hidden rounded-none bg-[var(--bg)]"
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
          className="pointer-events-none absolute -inset-x-px -bottom-px h-[48%] sm:h-[42%] lg:h-[36%] bg-gradient-to-t from-[var(--bg)] via-[var(--bg)]/75 to-transparent"
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
                onMouseEnter={() => prefetchRoute('/produk')}
                onFocus={() => prefetchRoute('/produk')}
                className="min-h-9 px-3.5 py-1.5 text-xs"
              >
                Lihat Produk
                <ArrowRight className="size-3.5 shrink-0" aria-hidden="true" />
              </LinkButton>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleRequestSurvey}
                data-testid="hero-minta-survei-btn"
                className="min-h-9 px-3.5 py-1.5 text-xs"
              >
                <Headset className="size-3.5 shrink-0" aria-hidden="true" />
                Minta Survei
              </Button>
            </div>
          </div>
        </Container>
      </div>
    </section>
  );
}
