import { createContext, useContext, useEffect, useState, type ImgHTMLAttributes, type ReactNode } from 'react';

export interface ThumbnailRetryOptions {
  /** Extra load attempts after the first failure. Default 2. */
  attempts?: number;
  /** Wait before the first retry, in ms; each later retry waits twice as long. Default 1000. */
  delayMs?: number;
}

const DEFAULT_RETRY: Required<ThumbnailRetryOptions> = { attempts: 2, delayMs: 1000 };

const ThumbnailRetryContext = createContext<ThumbnailRetryOptions | false>(DEFAULT_RETRY);

export interface PhotoCalendarThumbnailRetryProviderProps {
  /** Retry settings for every thumbnail below; `false` turns retrying off. */
  value: ThumbnailRetryOptions | false;
  children: ReactNode;
}

export function PhotoCalendarThumbnailRetryProvider({ value, children }: PhotoCalendarThumbnailRetryProviderProps) {
  return <ThumbnailRetryContext.Provider value={value}>{children}</ThumbnailRetryContext.Provider>;
}

export interface PhotoCalendarThumbnailProps extends ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  /** Overrides the surrounding retry settings for this image; `false` turns retrying off. */
  retry?: ThumbnailRetryOptions | false;
}

/**
 * A day thumbnail that retries a failed load. Browsers never retry a failed
 * `<img>` on their own, so a transient error (e.g. a 503 from a rate-limited
 * image host) would otherwise leave the cell empty. Each retry remounts the
 * element with the same `src`, which keeps signed URLs intact. Once the
 * retries run out the image gets `data-failed`.
 */
export function PhotoCalendarThumbnail({ src, retry, onError, ...props }: PhotoCalendarThumbnailProps) {
  const inherited = useContext(ThumbnailRetryContext);
  const settings = retry ?? inherited;
  const { attempts, delayMs } = settings === false ? { attempts: 0, delayMs: 0 } : { ...DEFAULT_RETRY, ...settings };

  const [attempt, setAttempt] = useState(0);
  const [errored, setErrored] = useState(false);
  const [loadedSrc, setLoadedSrc] = useState(src);
  if (loadedSrc !== src) {
    // A new photo starts over.
    setLoadedSrc(src);
    setAttempt(0);
    setErrored(false);
  }

  useEffect(() => {
    if (!errored || attempt >= attempts) return;
    const timer = setTimeout(() => {
      setAttempt((current) => current + 1);
      setErrored(false);
    }, delayMs * 2 ** attempt);
    return () => clearTimeout(timer);
  }, [errored, attempt, attempts, delayMs]);

  return (
    <img
      // A new key remounts the element, which makes the browser request it again.
      key={attempt}
      src={src}
      data-failed={errored && attempt >= attempts ? '' : undefined}
      onError={(event) => {
        setErrored(true);
        onError?.(event);
      }}
      {...props}
    />
  );
}
