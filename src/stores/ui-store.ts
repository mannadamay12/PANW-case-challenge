import { create } from "zustand";

interface UIState {
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
}

export const useUIStore = create<UIState>((set) => ({
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
    }),
  closeEditor: () => set({ isEditorOpen: false, isNewEntry: false }),

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
}));
