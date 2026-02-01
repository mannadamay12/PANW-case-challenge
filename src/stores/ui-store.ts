import { create } from "zustand";

export type MainView = "dashboard" | "journal" | "chat" | "library";

interface UIState {
  // View switching
  activeView: MainView;
  setActiveView: (view: MainView) => void;

  // Selection
  selectedEntryId: string | null;
  setSelectedEntryId: (id: string | null) => void;

  // Editor
  isEditorOpen: boolean;
  isNewEntry: boolean;
  openEditor: (entryId?: string) => void;
  closeEditor: () => void;

  // Sidebar
  isSidebarOpen: boolean;
  toggleSidebar: () => void;

  // Search
  searchQuery: string;
  setSearchQuery: (query: string) => void;

  // Filters
  showArchived: boolean;
  toggleShowArchived: () => void;

  // Modals
  deleteConfirmId: string | null;
  setDeleteConfirmId: (id: string | null) => void;

  // Template modals
  showTemplateModal: boolean;
  setShowTemplateModal: (show: boolean) => void;
  editingTemplateId: string | null;
  setEditingTemplateId: (id: string | null) => void;

  // Template to editor flow
  pendingTemplateText: string | null;
  pendingTemplateTitle: string | null;
  openEditorWithTemplate: (templateText: string, templateTitle: string) => void;
  clearPendingTemplate: () => void;

  // AI Panel
  isAIPanelOpen: boolean;
  setAIPanelOpen: (open: boolean) => void;
  toggleAIPanel: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  // View switching - default to dashboard
  activeView: "dashboard",
  setActiveView: (view) => set({ activeView: view }),

  // Selection
  selectedEntryId: null,
  setSelectedEntryId: (id) => set({ selectedEntryId: id }),

  // Editor
  isEditorOpen: false,
  isNewEntry: false,
  openEditor: (entryId) =>
    set({
      isEditorOpen: true,
      isNewEntry: !entryId,
      selectedEntryId: entryId ?? null,
      activeView: "journal",
    }),
  closeEditor: () => set({ isEditorOpen: false, isNewEntry: false, selectedEntryId: null }),

  // Sidebar
  isSidebarOpen: true,
  toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),

  // Search
  searchQuery: "",
  setSearchQuery: (query) => set({ searchQuery: query }),

  // Filters
  showArchived: false,
  toggleShowArchived: () => set((s) => ({ showArchived: !s.showArchived })),

  // Modals
  deleteConfirmId: null,
  setDeleteConfirmId: (id) => set({ deleteConfirmId: id }),

  // Template modals
  showTemplateModal: false,
  setShowTemplateModal: (show) => set({ showTemplateModal: show }),
  editingTemplateId: null,
  setEditingTemplateId: (id) => set({ editingTemplateId: id }),

  // Template to editor flow
  pendingTemplateText: null,
  pendingTemplateTitle: null,
  openEditorWithTemplate: (templateText, templateTitle) =>
    set({
      pendingTemplateText: templateText,
      pendingTemplateTitle: templateTitle,
      isEditorOpen: true,
      isNewEntry: true,
      selectedEntryId: null,
      activeView: "journal",
    }),
  clearPendingTemplate: () =>
    set({ pendingTemplateText: null, pendingTemplateTitle: null }),

  // AI Panel - collapsed by default
  isAIPanelOpen: false,
  setAIPanelOpen: (open) => set({ isAIPanelOpen: open }),
  toggleAIPanel: () => set((s) => ({ isAIPanelOpen: !s.isAIPanelOpen })),
}));
