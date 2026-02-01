import { Plus } from "@phosphor-icons/react";
import { TemplateIcon } from "./IconPicker";
import type { Template } from "../../types/templates";

interface TemplateCardProps {
  template: Template;
  onUse: (template: Template) => void;
  animationDelay?: number;
}

export function TemplateCard({ template, onUse, animationDelay = 0 }: TemplateCardProps) {
  return (
    <div
      className="bg-white dark:bg-sanctuary-card rounded-2xl p-4 shadow-sm cursor-pointer animate-fade-up hover:shadow-md transition-shadow"
      style={{ animationDelay: `${animationDelay}ms` }}
    >
      {/* Header row: icon and plus button */}
      <div className="flex items-start justify-between mb-4">
        <TemplateIcon
          icon={template.icon}
          size="lg"
          className="text-sanctuary-text"
        />
        <button
          onClick={() => onUse(template)}
          className="w-8 h-8 rounded-full bg-sanctuary-hover flex items-center justify-center text-sanctuary-muted hover:bg-sanctuary-selected transition-colors cursor-pointer active:scale-95"
          title="Use template"
        >
          <Plus className="h-4 w-4" weight="bold" />
        </button>
      </div>

      {/* Title */}
      <h3 className="font-semibold text-sanctuary-text mb-1">
        {template.title}
      </h3>

      {/* Description/prompt preview */}
      <p className="text-sm text-sanctuary-muted line-clamp-1">
        {template.template_text}
      </p>
    </div>
  );
}
