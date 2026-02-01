import { Plus, Pencil, Trash2, MoreVertical } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { TemplateIcon } from "./IconPicker";
import { Button } from "../ui/Button";
import type { Template } from "../../types/templates";

interface TemplateCardProps {
  template: Template;
  onUse: (template: Template) => void;
  onEdit: (template: Template) => void;
  onDelete: (template: Template) => void;
}

export function TemplateCard({ template, onUse, onEdit, onDelete }: TemplateCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu]);

  return (
    <div className="group relative bg-sanctuary-card border border-sanctuary-border rounded-xl p-4 hover:shadow-md transition-shadow">
      {/* Icon */}
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-full bg-sanctuary-accent/10 flex items-center justify-center text-sanctuary-accent">
          <TemplateIcon icon={template.icon} size="md" />
        </div>

        {/* Quick use button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onUse(template)}
          className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
          title="Use template"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Title */}
      <h3 className="font-medium text-sanctuary-text mb-1 truncate">{template.title}</h3>

      {/* Template text preview */}
      <p className="text-sm text-sanctuary-muted line-clamp-2">{template.template_text}</p>

      {/* Actions menu */}
      <div ref={menuRef} className="absolute top-2 right-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setShowMenu(!showMenu)}
          className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6"
        >
          <MoreVertical className="h-3 w-3" />
        </Button>

        {showMenu && (
          <div className="absolute right-0 top-8 z-10 w-32 rounded-lg border border-sanctuary-border bg-sanctuary-card py-1 shadow-lg">
            <button
              onClick={() => {
                setShowMenu(false);
                onEdit(template);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-sanctuary-muted hover:bg-sanctuary-hover hover:text-sanctuary-text"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </button>
            {!template.is_default && (
              <button
                onClick={() => {
                  setShowMenu(false);
                  onDelete(template);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            )}
          </div>
        )}
      </div>

      {/* Default badge */}
      {template.is_default && (
        <div className="absolute bottom-2 right-2">
          <span className="text-xs text-sanctuary-muted/60 bg-sanctuary-hover px-2 py-0.5 rounded-full">
            Default
          </span>
        </div>
      )}
    </div>
  );
}
