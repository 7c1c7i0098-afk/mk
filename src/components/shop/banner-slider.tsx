"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { cn } from "@/lib/utils";

export type BannerSlide = {
  id: string;
  image: string | null;
  title: string | null;
  subtitle: string | null;
  ctaText: string | null;
  ctaLink: string | null;
};

const ASPECT = "aspect-16/9 sm:aspect-[16/6.5] lg:aspect-[16/5]";

export function BannerSlider({ banners }: { banners: BannerSlide[] }) {
  const multiple = banners.length > 1;
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: multiple, direction: "rtl", align: "start", containScroll: "trimSnaps" },
    multiple ? [Autoplay({ delay: 5000, stopOnInteraction: false, stopOnMouseEnter: true })] : [],
  );
  const [selected, setSelected] = useState(0);

  const onSelect = useCallback(() => {
    if (emblaApi) setSelected(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect).on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect).off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  if (banners.length === 0) return null;

  return (
    <section aria-label="عروض وإعلانات">
      <div className="overflow-hidden rounded-3xl" ref={emblaRef}>
        <div className="flex touch-pan-y">
          {banners.map((banner, index) => (
            <div key={banner.id} className="min-w-0 flex-[0_0_100%]">
              <Slide banner={banner} priority={index === 0} />
            </div>
          ))}
        </div>
      </div>

      {multiple && (
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {banners.map((banner, index) => (
            <button
              key={banner.id}
              type="button"
              onClick={() => emblaApi?.scrollTo(index)}
              aria-label={`الانتقال إلى الشريحة ${index + 1}`}
              aria-current={index === selected}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                index === selected ? "w-6 bg-brand" : "w-1.5 bg-line hover:bg-muted-2",
              )}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function Slide({ banner, priority }: { banner: BannerSlide; priority: boolean }) {
  const hasOverlayText = Boolean(banner.title || banner.subtitle || banner.ctaText);

  const content = (
    <div className={cn("relative w-full overflow-hidden bg-surface", ASPECT)}>
      {banner.image ? (
        <>
          <Image
            src={banner.image}
            alt={banner.title ?? "إعلان"}
            fill
            priority={priority}
            sizes="(max-width: 1024px) 100vw, 1024px"
            className="object-cover"
          />
          {hasOverlayText && (
            <div className="absolute inset-0 bg-linear-to-t from-ink/90 via-ink/35 to-transparent" />
          )}
        </>
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(125%_125%_at_92%_8%,#3b82f6_0%,#1e3a8a_38%,#1b2432_78%)]" />
      )}

      {hasOverlayText && (
        <div className="absolute inset-0 flex flex-col justify-end gap-1 p-4 sm:justify-center sm:p-7">
          {banner.title && (
            <h2 className="text-lg font-bold leading-tight text-white drop-shadow-sm sm:text-2xl lg:text-3xl">
              {banner.title}
            </h2>
          )}
          {banner.subtitle && (
            <p className="max-w-[26ch] text-xs text-white/80 sm:text-sm lg:text-base">
              {banner.subtitle}
            </p>
          )}
          {banner.ctaText && (
            <span className="tap mt-2 inline-flex w-fit items-center rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-white shadow-card hover:bg-brand-600 sm:text-sm">
              {banner.ctaText}
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (!banner.ctaLink) return content;

  return (
    <Link href={banner.ctaLink} className="block" draggable={false}>
      {content}
    </Link>
  );
}
