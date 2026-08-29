import { useEffect, useState } from "react";

interface ZoomableImageProps {
  src: string;
  alt: string;
}

// Wraps a thumbnail image so clicking it opens a full-size lightbox view -
// the thumbnails on Topics 6 & 7 (GBP/form screenshots) are small by
// design (they sit inside fixed-height card tiles), so this is the way to
// actually read the fine print in one without leaving the page.
export default function ZoomableImage({ src, alt }: ZoomableImageProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="zoomable-trigger"
        onClick={() => setOpen(true)}
        aria-label={`Enlarge screenshot: ${alt}`}
        title="Click to enlarge"
      >
        <img src={src} alt={alt} />
      </button>
      {open && (
        <div className="lightbox-overlay" onClick={() => setOpen(false)}>
          <button type="button" className="lightbox-close" onClick={() => setOpen(false)} aria-label="Close enlarged view">
            ×
          </button>
          <img className="lightbox-image" src={src} alt={alt} onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}
