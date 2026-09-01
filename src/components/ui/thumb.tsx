import Image from "next/image";
import { cn, initials } from "@/lib/utils";

type ThumbProps = {
  src?: string | null;
  alt: string;
  /** Passed to next/image for correct responsive sizing. */
  sizes?: string;
  className?: string;
  /** Extra classes on the <img> itself, e.g. a slight scale to trim padding. */
  imageClassName?: string;
  rounded?: string;
  /**
   * Background behind the artwork, as a single background utility.
   *
   * It is a real prop rather than something passed through `className`, so
   * exactly one `bg-*` class is ever emitted. Two competing background classes
   * would be resolved by stylesheet order, not by the order they were written,
   * which is how transparent artwork ended up sitting on a white square.
   */
  surface?: string;
  /** Hairline border around the tile. Off for artwork that carries its own frame. */
  ringed?: boolean;
  /**
   * Draws the artwork as unavailable: a light veil and a partial drain of
   * colour. Deliberately gentle — enough that a sold-out card reads differently
   * at a glance, not so much that the artwork stops being recognisable.
   */
  dimmed?: boolean;
  priority?: boolean;
};

/**
 * Square artwork tile. Admin-uploaded images fill the tile with object-cover so
 * proportions are preserved; when no image has been uploaded yet a neutral
 * placeholder keeps the grid intact (no icons, no emojis).
 */
export function Thumb({
  src,
  alt,
  sizes = "(max-width: 768px) 33vw, 180px",
  className,
  imageClassName,
  rounded = "rounded-2xl",
  surface = "bg-surface",
  ringed = true,
  dimmed = false,
  priority,
}: ThumbProps) {
  return (
    <div
      className={cn(
        "relative aspect-square w-full overflow-hidden",
        surface,
        ringed && "ring-1 ring-line/70",
        rounded,
        className,
      )}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          className={cn(
            "object-cover",
            dimmed && "opacity-75 grayscale-[0.55]",
            imageClassName,
          )}
          priority={priority}
        />
      ) : (
        // Flat cool-grey token, never a gradient ending in pure #FFFFFF —
        // that read as a bright white block on the light theme.
        <div className="flex h-full w-full items-center justify-center bg-surface-2">
          <span className="text-lg font-semibold text-muted-2">{initials(alt)}</span>
        </div>
      )}

      {/* Sits above the artwork but below anything the caller stacks on top. */}
      {dimmed && <span aria-hidden className="absolute inset-0 z-0 bg-ink/20" />}
    </div>
  );
}
