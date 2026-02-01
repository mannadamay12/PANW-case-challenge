import { useState, useEffect, useRef } from "react";
import { X } from "@phosphor-icons/react";
import { Button } from "../ui/Button";
import { IconPicker, TemplateIcon } from "./IconPicker";
import { cn } from "../../lib/utils";
import { useAnimatedPresence } from "../../hooks/use-animated-presence";
import type { TemplateCategory } from "../../types/templates";
import {
  useCreateTemplate,
  useUpdateTemplate,
  useTemplate,
} from "../../hooks/use-templates";

interface TemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingId: string | null;
  defaultCategory?: TemplateCategory;
}

export function TemplateModal({ isOpen, onClose, editingId, defaultCategory = "reflection" }: TemplateModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { shouldRender, isAnimating } = useAnimatedPresence(isOpen, 150);

  const { data: existingTemplate } = useTemplate(editingId);
  const createMutation = useCreateTemplate();
  const updateMutation = useUpdateTemplate();

  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [templateText, setTemplateText] = useState("");
  const [icon, setIcon] = useState<string>("heart");
  const [category, setCategory] = useState<TemplateCategory>(defaultCategory);
  const [showIconPicker, setShowIconPicker] = useState(false);

  const isEditing = !!editingId;

  // Reset form when opening/closing or switching templates
  useEffect(() => {
    if (isOpen && existingTemplate) {
      setTitle(existingTemplate.title);
      setPrompt(existingTemplate.prompt);
      setTemplateText(existingTemplate.template_text);
      setIcon(existingTemplate.icon || "heart");
      setCategory(existingTemplate.category);
    } else if (isOpen && !editingId) {
      setTitle("");
      setPrompt("");
      setTemplateText("");
      setIcon("heart");
      setCategory(defaultCategory);
    }
  }, [isOpen, existingTemplate, editingId, defaultCategory]);

  // Dialog open/close
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (shouldRender) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [shouldRender]);

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === dialogRef.current) {
      onClose();
    }
  };

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !prompt.trim()) return;

    if (isEditing && editingId) {
      await updateMutation.mutateAsync({
        id: editingId,
        title: title.trim(),
        prompt: prompt.trim(),
        template_text: templateText.trim(),
        icon,
        category,
      });
    } else {
      await createMutation.mutateAsync({
        title: title.trim(),
        prompt: prompt.trim(),
        template_text: templateText.trim(),
        icon,
        category,
      });
    }

    onClose();
  };

  const isLoading = createMutation.isPending || updateMutation.isPending;

  if (!shouldRender) return null;

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className={cn(
        "fixed inset-0 z-50 m-auto max-w-md w-full rounded-2xl border border-sanctuary-border bg-sanctuary-card p-0 shadow-xl backdrop:bg-black/50",
        isAnimating ? "animate-scale-in" : "animate-scale-out"
      )}
    >
      <form onSubmit={handleSubmit}>
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <h2 className="text-xl font-semibold text-sanctuary-text">
              {isEditing ? "Edit Template" : "New Template"}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-lg text-sanctuary-muted hover:text-sanctuary-text hover:bg-sanctuary-hover transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Icon picker */}
          <div className="mb-5">
            <button
              type="button"
              onClick={() => setShowIconPicker(!showIconPicker)}
              className="w-14 h-14 rounded-xl bg-sanctuary-hover flex items-center justify-center text-sanctuary-text hover:bg-sanctuary-selected transition-colors"
            >
              <TemplateIcon icon={icon} size="lg" />
            </button>

            {showIconPicker && (
              <div className="mt-3 p-4 border border-sanctuary-border rounded-xl bg-sanctuary-bg">
                <IconPicker
                  value={icon}
                  onChange={(newIcon) => {
                    setIcon(newIcon);
                    setShowIconPicker(false);
                  }}
                />
              </div>
            )}
          </div>

          {/* Title */}
          <div className="mb-4">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              className="w-full px-4 py-3 rounded-xl border border-sanctuary-border bg-sanctuary-card text-sanctuary-text placeholder:text-sanctuary-muted/50 focus:outline-none focus:ring-2 focus:ring-sanctuary-accent"
              required
            />
          </div>

          {/* Prompt */}
          <div className="mb-4">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Guiding question..."
              rows={2}
              className="w-full px-4 py-3 rounded-xl border border-sanctuary-border bg-sanctuary-card text-sanctuary-text placeholder:text-sanctuary-muted/50 focus:outline-none focus:ring-2 focus:ring-sanctuary-accent resize-none"
              required
            />
          </div>

          {/* Template text */}
          <div className="mb-6">
            <textarea
              value={templateText}
              onChange={(e) => setTemplateText(e.target.value)}
              placeholder="Starter text..."
              rows={2}
              className="w-full px-4 py-3 rounded-xl border border-sanctuary-border bg-sanctuary-card text-sanctuary-text placeholder:text-sanctuary-muted/50 focus:outline-none focus:ring-2 focus:ring-sanctuary-accent resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !title.trim() || !prompt.trim()}
              className="flex-1"
            >
              {isLoading ? "Saving..." : isEditing ? "Save" : "Create"}
            </Button>
          </div>
        </div>
      </form>
    </dialog>
  );
}
