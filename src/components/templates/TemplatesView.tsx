import { useState } from "react";
import { Plus, Search, BookTemplate, Loader2 } from "lucide-react";
import { useTemplates, useDeleteTemplate } from "../../hooks/use-templates";
import { useUIStore } from "../../stores/ui-store";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { TemplateGrid } from "./TemplateGrid";
import { TemplateModal } from "./TemplateModal";
import type { Template } from "../../types/templates";

export function TemplatesView() {
  const { data: templates, isLoading, error } = useTemplates();
  const deleteMutation = useDeleteTemplate();
  const {
    showTemplateModal,
    setShowTemplateModal,
    editingTemplateId,
    setEditingTemplateId,
    openEditorWithTemplate,
  } = useUIStore();

  const [searchQuery, setSearchQuery] = useState("");
  const [deleteConfirmTemplate, setDeleteConfirmTemplate] = useState<Template | null>(null);

  // Filter templates by search query
  const filteredTemplates = templates?.filter((t) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      t.title.toLowerCase().includes(query) ||
      t.prompt.toLowerCase().includes(query) ||
      t.template_text.toLowerCase().includes(query)
    );
  });

  const handleUseTemplate = (template: Template) => {
    openEditorWithTemplate(template.template_text, template.title);
  };

  const handleEditTemplate = (template: Template) => {
    setEditingTemplateId(template.id);
    setShowTemplateModal(true);
  };

  const handleDeleteTemplate = (template: Template) => {
    setDeleteConfirmTemplate(template);
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

  const handleNewTemplate = () => {
    setEditingTemplateId(null);
    setShowTemplateModal(true);
  };

  const handleCloseModal = () => {
    setShowTemplateModal(false);
    setEditingTemplateId(null);
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-sanctuary-accent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-red-600">Failed to load templates</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-sanctuary-card">
      {/* Compact header */}
      <div className="px-6 py-4 border-b border-sanctuary-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <BookTemplate className="h-5 w-5 text-sanctuary-muted" />
            <h1 className="text-lg font-medium text-sanctuary-text">Library</h1>
          </div>
          <Button onClick={handleNewTemplate} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-sanctuary-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search templates..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-sanctuary-border bg-sanctuary-card text-sanctuary-text placeholder:text-sanctuary-muted/50 focus:outline-none focus:ring-2 focus:ring-sanctuary-accent"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {filteredTemplates && filteredTemplates.length > 0 ? (
          <TemplateGrid
            templates={filteredTemplates}
            onUse={handleUseTemplate}
            onEdit={handleEditTemplate}
            onDelete={handleDeleteTemplate}
          />
        ) : searchQuery ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Search className="h-12 w-12 text-sanctuary-muted/30 mb-4" />
            <p className="text-sanctuary-muted">No templates match "{searchQuery}"</p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <BookTemplate className="h-12 w-12 text-sanctuary-muted/30 mb-4" />
            <p className="text-sanctuary-muted mb-4">No templates yet</p>
            <Button onClick={handleNewTemplate}>
              <Plus className="h-4 w-4 mr-2" />
              Create your first template
            </Button>
          </div>
        )}
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
