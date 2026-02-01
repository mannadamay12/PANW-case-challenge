import { useState } from "react";
import { ArrowLeft, Plus, CircleNotch } from "@phosphor-icons/react";
import { useTemplates, useDeleteTemplate } from "../../hooks/use-templates";
import { useUIStore } from "../../stores/ui-store";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { TemplateGrid } from "./TemplateGrid";
import { TemplateModal } from "./TemplateModal";
import type { Template, TemplateCategory } from "../../types/templates";
import { CATEGORY_LABELS, CATEGORY_ORDER } from "../../types/templates";

export function TemplatesView() {
  const { data: templates, isLoading, error } = useTemplates();
  const deleteMutation = useDeleteTemplate();
  const {
    showTemplateModal,
    setShowTemplateModal,
    editingTemplateId,
    setEditingTemplateId,
    openEditorWithTemplate,
    setActiveView,
  } = useUIStore();

  const [deleteConfirmTemplate, setDeleteConfirmTemplate] = useState<Template | null>(null);

  // Group templates by category
  const templatesByCategory = templates?.reduce<Record<TemplateCategory, Template[]>>(
    (acc, template) => {
      if (!acc[template.category]) {
        acc[template.category] = [];
      }
      acc[template.category].push(template);
      return acc;
    },
    {} as Record<TemplateCategory, Template[]>
  );

  const handleUseTemplate = (template: Template) => {
    openEditorWithTemplate(template.template_text, template.title);
  };

  const handleNewTemplate = () => {
    setEditingTemplateId(null);
    setShowTemplateModal(true);
  };

  const handleCloseModal = () => {
    setShowTemplateModal(false);
    setEditingTemplateId(null);
  };

  const handleConfirmDelete = () => {
    if (deleteConfirmTemplate) {
      deleteMutation.mutate(deleteConfirmTemplate.id, {
        onSuccess: () => {
          setDeleteConfirmTemplate(null);
        },
      });
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-sanctuary-bg">
        <CircleNotch className="h-8 w-8 animate-spin text-sanctuary-accent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-sanctuary-bg">
        <p className="text-red-600">Failed to load templates</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-sanctuary-bg">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setActiveView("journal")}
            className="w-8 h-8 rounded-full bg-sanctuary-hover flex items-center justify-center text-sanctuary-muted hover:bg-sanctuary-selected hover:text-sanctuary-text transition-colors cursor-pointer"
            title="Back to dashboard"
          >
            <ArrowLeft className="h-4 w-4" weight="bold" />
          </button>
          <h1 className="text-2xl font-bold text-sanctuary-text">Gallery</h1>
        </div>
        <button
          onClick={handleNewTemplate}
          className="w-8 h-8 rounded-full bg-sanctuary-hover flex items-center justify-center text-sanctuary-muted hover:bg-sanctuary-selected transition-colors cursor-pointer"
          title="New template"
        >
          <Plus className="h-4 w-4" weight="bold" />
        </button>
      </div>

      {/* Templates grouped by category */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        <div className="max-w-3xl mx-auto space-y-8">
          {CATEGORY_ORDER.map((category) => {
            const categoryTemplates = templatesByCategory?.[category] || [];

            return (
              <section key={category}>
                {/* Category header */}
                <h2 className="text-xl font-semibold text-sanctuary-text mb-4">
                  {CATEGORY_LABELS[category]}
                </h2>

                {/* Templates grid */}
                {categoryTemplates.length > 0 ? (
                  <TemplateGrid templates={categoryTemplates} onUse={handleUseTemplate} />
                ) : (
                  <div className="py-8 text-center">
                    <p className="text-sanctuary-muted text-sm">No templates yet</p>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>

      {/* Template Modal */}
      <TemplateModal
        isOpen={showTemplateModal}
        onClose={handleCloseModal}
        editingId={editingTemplateId}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteConfirmTemplate !== null}
        onClose={() => setDeleteConfirmTemplate(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Template"
        description={`Are you sure you want to delete "${deleteConfirmTemplate?.title}"? This action cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
