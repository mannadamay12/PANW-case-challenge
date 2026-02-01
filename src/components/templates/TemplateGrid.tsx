import { TemplateCard } from "./TemplateCard";
import type { Template, TemplateCategory } from "../../types/templates";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "../../types/templates";

interface TemplateGridProps {
  templates: Template[];
  onUse: (template: Template) => void;
  onEdit: (template: Template) => void;
  onDelete: (template: Template) => void;
}

export function TemplateGrid({ templates, onUse, onEdit, onDelete }: TemplateGridProps) {
  // Group templates by category
  const grouped = templates.reduce<Record<TemplateCategory, Template[]>>(
    (acc, template) => {
      const category = template.category;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(template);
      return acc;
    },
    {} as Record<TemplateCategory, Template[]>
  );

  return (
    <div className="space-y-8">
      {CATEGORY_ORDER.map((category) => {
        const categoryTemplates = grouped[category];
        if (!categoryTemplates || categoryTemplates.length === 0) return null;

        return (
          <section key={category}>
            <h2 className="text-lg font-semibold text-sanctuary-text mb-4 capitalize">
              {CATEGORY_LABELS[category]}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {categoryTemplates.map((template) => (
                <TemplateCard
                  key={template.id}
                  template={template}
                  onUse={onUse}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
