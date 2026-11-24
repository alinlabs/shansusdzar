export type ResolvedVideoSource =
  | { kind: 'native'; src: string }
  | { kind: 'embed'; src: string }
  | { kind: 'invalid'; src: '' };

export type VisualMediaSlide =
  | {
      id: string;
      kind: 'image';
      src: string | null;
      title: string;
      fallbackLabel?: string;
    }
  | {
      id: string;
      kind: 'video';
      src: string;
      poster?: string;
      title: string;
    };

export function resolveVideoSource(rawUrl: string): ResolvedVideoSource {
  const trimmed = rawUrl.trim();
  if (!trimmed) return { kind: 'invalid', src: '' };

  if (trimmed.startsWith('/')) {
    return { kind: 'native', src: trimmed };
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { kind: 'invalid', src: '' };
    }

    const host = parsed.hostname.toLowerCase();

    if (host === 'youtu.be') {
      const id = parsed.pathname.replace(/^\/+/, '').split('/')[0];
      if (id) {
        return { kind: 'embed', src: `https://www.youtube.com/embed/${encodeURIComponent(id)}` };
      }
    }

    if (host === 'youtube.com' || host === 'www.youtube.com' || host === 'm.youtube.com') {
      const watchId = parsed.searchParams.get('v');
      if (watchId) {
        return {
          kind: 'embed',
          src: `https://www.youtube.com/embed/${encodeURIComponent(watchId)}`,
        };
      }
      const pathParts = parsed.pathname.split('/').filter(Boolean);
      if ((pathParts[0] === 'embed' || pathParts[0] === 'shorts') && pathParts[1]) {
        return {
          kind: 'embed',
          src: `https://www.youtube.com/embed/${encodeURIComponent(pathParts[1])}`,
        };
      }
    }

    if (host === 'vimeo.com' || host === 'www.vimeo.com' || host === 'player.vimeo.com') {
      const pathParts = parsed.pathname.split('/').filter(Boolean);
      const id = pathParts[pathParts.length - 1];
      if (id && /^\d+$/.test(id)) {
        return {
          kind: 'embed',
          src: `https://player.vimeo.com/video/${encodeURIComponent(id)}`,
        };
      }
    }

    return { kind: 'native', src: parsed.toString() };
  } catch {
    return { kind: 'invalid', src: '' };
  }
}
