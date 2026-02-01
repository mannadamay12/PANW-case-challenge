import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Trash2, Loader2, ImageOff } from "lucide-react";
import { cn } from "../../lib/utils";

interface InlineImageProps {
  relativePath: string;
  alt?: string;
  onDelete?: () => void;
  className?: string;
}

export function InlineImage({
  relativePath,
  alt = "Journal image",
  onDelete,
  className,
}: InlineImageProps) {
  const [imageData, setImageData] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onDelete || isDeleting) return;

    setIsDeleting(true);
    onDelete();
  };

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
        <Loader2 className="h-6 w-6 animate-spin text-sanctuary-muted" />
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
        <ImageOff className="h-5 w-5" />
        <span>Image not found</span>
      </div>
    );
  }

  return (
    <div
      className={cn("relative inline-block my-2", className)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <img
        src={`data:${mimeType};base64,${imageData}`}
        alt={alt}
        className="max-w-full h-auto rounded-lg"
      />

      {onDelete && isHovered && (
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
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
        </button>
      )}
    </div>
  );
}
