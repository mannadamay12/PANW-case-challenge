import { useState, useEffect, useRef, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Trash, CircleNotch, ImageBroken } from "@phosphor-icons/react";
import { cn } from "../../lib/utils";

interface InlineImageProps {
  relativePath: string;
  alt?: string;
  width?: number;
  height?: number;
  onDelete?: () => void;
  onResize?: (width: number) => void;
  className?: string;
}

export function InlineImage({
  relativePath,
  alt = "Journal image",
  width,
  height,
  onDelete,
  onResize,
  className,
}: InlineImageProps) {
  const [imageData, setImageData] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [currentWidth, setCurrentWidth] = useState<number | undefined>(width);

  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const startPosRef = useRef<{ x: number; y: number; width: number }>({
    x: 0,
    y: 0,
    width: 0,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadImage() {
      setIsLoading(true);
      setError(null);

      try {
        const base64 = await invoke<string>("get_image_data", {
          relativePath,
        });
        if (!cancelled) {
          setImageData(base64);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load image");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    loadImage();
    return () => {
      cancelled = true;
    };
  }, [relativePath]);

  // Update currentWidth when prop changes (e.g., when loading entry)
  useEffect(() => {
    setCurrentWidth(width);
  }, [width]);


  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onDelete || isDeleting) return;

    setIsDeleting(true);
    onDelete();
  };

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const img = imageRef.current;
      if (!img) return;

      setIsResizing(true);
      startPosRef.current = {
        x: e.clientX,
        y: e.clientY,
        width: img.offsetWidth,
      };

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startPosRef.current.x;
        const newWidth = Math.max(100, startPosRef.current.width + deltaX);
        setCurrentWidth(newWidth);
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);

        // Report final width
        if (onResize && imageRef.current) {
          const finalWidth = imageRef.current.offsetWidth;
          onResize(finalWidth);
        }
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [onResize]
  );

  // Derive mime type from path
  const mimeType = relativePath.endsWith(".png")
    ? "image/png"
    : relativePath.endsWith(".gif")
      ? "image/gif"
      : relativePath.endsWith(".webp")
        ? "image/webp"
        : "image/jpeg";

  if (isLoading) {
    return (
      <div
        className={cn(
          "inline-flex items-center justify-center bg-sanctuary-hover rounded-lg",
          "min-h-[100px] min-w-[150px]",
          className
        )}
      >
        <CircleNotch className="h-6 w-6 animate-spin text-sanctuary-muted" />
      </div>
    );
  }

  if (error || !imageData) {
    return (
      <div
        className={cn(
          "inline-flex items-center justify-center gap-2 bg-sanctuary-hover rounded-lg px-4 py-3",
          "text-sanctuary-muted text-sm",
          className
        )}
      >
        <ImageBroken className="h-5 w-5" />
        <span>Image not found</span>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn("relative inline-block my-2", className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <img
        ref={imageRef}
        src={`data:${mimeType};base64,${imageData}`}
        alt={alt}
        style={{
          width: currentWidth ? `${currentWidth}px` : undefined,
          height: height && !currentWidth ? `${height}px` : "auto",
        }}
        className={cn(
          "max-w-full rounded-lg",
          isResizing && "select-none pointer-events-none"
        )}
      />

      {/* Delete button */}
      {onDelete && isHovered && !isResizing && (
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className={cn(
            "absolute top-2 right-2 p-1.5 rounded-md",
            "bg-sanctuary-card/90 hover:bg-red-50 dark:hover:bg-red-950 text-sanctuary-muted hover:text-red-600",
            "shadow-sm border border-sanctuary-border",
            "transition-colors duration-150",
            isDeleting && "opacity-50 cursor-not-allowed"
          )}
          title="Delete image"
        >
          {isDeleting ? (
            <CircleNotch className="h-4 w-4 animate-spin" />
          ) : (
            <Trash className="h-4 w-4" />
          )}
        </button>
      )}

      {/* Resize handle (bottom-right corner) */}
      {onResize && (isHovered || isResizing) && (
        <div
          onMouseDown={handleResizeStart}
          className={cn(
            "absolute bottom-1 right-1 w-4 h-4 cursor-se-resize",
            "bg-sanctuary-card/90 border border-sanctuary-border rounded-sm",
            "hover:bg-sanctuary-hover",
            "flex items-center justify-center",
            isResizing && "bg-sanctuary-accent"
          )}
          title="Drag to resize"
        >
          {/* Resize icon (diagonal lines) */}
          <svg
            width="8"
            height="8"
            viewBox="0 0 8 8"
            className="text-sanctuary-muted"
          >
            <path
              d="M7 1L1 7M7 4L4 7"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
      )}
    </div>
  );
}
