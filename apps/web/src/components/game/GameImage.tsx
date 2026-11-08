import { resolveAsset, type AssetEntry } from '@/lib/assets';
import { cn } from '@/lib/utils';

/**
 * Renders an official asset (responsive WebP when optimized), or `fallback` when the
 * artwork has not been delivered yet. Width/height are always set → no layout shift.
 */
export function GameImage({
  asset,
  className,
  sizes,
  priority = false,
  fallback,
  alt,
}: {
  asset: AssetEntry;
  className?: string;
  sizes?: string;
  priority?: boolean;
  fallback: React.ReactNode;
  alt?: string;
}) {
  const resolved = resolveAsset(asset);
  if (!resolved) return <>{fallback}</>;
  return (
    <img
      src={resolved.src}
      srcSet={resolved.srcSet ?? undefined}
      sizes={sizes}
      width={asset.width}
      height={asset.height}
      alt={alt ?? asset.alt}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      draggable={false}
      className={cn('select-none', className)}
    />
  );
}
