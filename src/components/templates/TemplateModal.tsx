import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button } from "../ui/Button";
import { IconPicker, TemplateIcon } from "./IconPicker";
import { cn } from "../../lib/utils";
import type { TemplateCategory } from "../../types/templates";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "../../types/templates";
import {
  useCreateTemplate,
  useUpdateTemplate,
  useTemplate,
} from "../../hooks/use-templates";

interface TemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingId: string | null;
}

export function TemplateModal({ isOpen, onClose, editingId }: TemplateModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const { data: existingTemplate } = useTemplate(editingId);
  const createMutation = useCreateTemplate();
  const updateMutation = useUpdateTemplate();

  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [templateText, setTemplateText] = useState("");
  const [icon, setIcon] = useState<string>("heart");
  const [category, setCategory] = useState<TemplateCategory>("reflection");
  const [showIconPicker, setShowIconPicker] = useState(false);

  const isEditing = !!editingId;
  const isDefault = existingTemplate?.is_default ?? false;

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
      setCategory("reflection");
    }
  }, [isOpen, existingTemplate, editingId]);

  // Dialog open/close
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [isOpen]);

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

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdropClick}
      className={cn(
        "fixed inset-0 z-50 m-auto max-w-lg w-full rounded-lg border border-sanctuary-border bg-sanctuary-card p-0 shadow-xl backdrop:bg-black/50",
        "open:animate-in open:fade-in-0 open:zoom-in-95"
      )}
    >
      <form onSubmit={handleSubmit}>
        <div className="p-6">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <h2 className="text-lg font-semibold text-sanctuary-text">
              {isEditing ? "Edit Template" : "New Template"}
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-sanctuary-muted hover:text-sanctuary-text transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Icon preview and picker */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-sanctuary-text mb-2">
              Icon
            </label>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setShowIconPicker(!showIconPicker)}
                className="w-16 h-16 rounded-xl bg-sanctuary-accent/10 flex items-center justify-center text-sanctuary-accent hover:bg-sanctuary-accent/20 transition-colors"
              >
                <TemplateIcon icon={icon} size="lg" />
              </button>
              <span className="text-sm text-sanctuary-muted">
                Click to change icon
              </span>
            </div>

            {showIconPicker && (
              <div className="mt-4 p-4 border border-sanctuary-border rounded-lg bg-stone-50">
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
            <label className="block text-sm font-medium text-sanctuary-text mb-2">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Daily Gratitude"
              className="w-full px-3 py-2 rounded-lg border border-sanctuary-border bg-white text-sanctuary-text placeholder:text-sanctuary-muted/50 focus:outline-none focus:ring-2 focus:ring-sanctuary-accent"
              required
              disabled={isDefault}
            />
          </div>

          {/* Category */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-sanctuary-text mb-2">
              Category
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as TemplateCategory)}
              className="w-full px-3 py-2 rounded-lg border border-sanctuary-border bg-white text-sanctuary-text focus:outline-none focus:ring-2 focus:ring-sanctuary-accent"
              disabled={isDefault}
            >
              {CATEGORY_ORDER.map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_LABELS[cat]}
                </option>
              ))}
            </select>
          </div>

          {/* Prompt */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-sanctuary-text mb-2">
              Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., What are three things I'm grateful for?"
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-sanctuary-border bg-white text-sanctuary-text placeholder:text-sanctuary-muted/50 focus:outline-none focus:ring-2 focus:ring-sanctuary-accent resize-none"
              required
            />
            <p className="text-xs text-sanctuary-muted mt-1">
              A guiding question for the journal entry
            </p>
          </div>

          {/* Template text */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-sanctuary-text mb-2">
              Starter Text
            </label>
            <textarea
              value={templateText}
              onChange={(e) => setTemplateText(e.target.value)}
              placeholder="e.g., Today I am grateful for"
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-sanctuary-border bg-white text-sanctuary-text placeholder:text-sanctuary-muted/50 focus:outline-none focus:ring-2 focus:ring-sanctuary-accent resize-none"
            />
            <p className="text-xs text-sanctuary-muted mt-1">
              Pre-filled text to start the entry
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !title.trim() || !prompt.trim()}>
              {isLoading ? "Saving..." : isEditing ? "Save Changes" : "Create Template"}
            </Button>
          </div>
        </div>
      </form>
    </dialog>
  );
}
