import { TemplateCard } from "./TemplateCard";
import type { Template } from "../../types/templates";

interface TemplateGridProps {
  templates: Template[];
  onUse: (template: Template) => void;
}

export function TemplateGrid({ templates, onUse }: TemplateGridProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {templates.map((template) => (
        <TemplateCard
          key={template.id}
          template={template}
          onUse={onUse}
        />
      ))}
    </div>
  );
}
