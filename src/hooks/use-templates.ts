import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import type {
  Template,
  CreateTemplateParams,
  UpdateTemplateParams,
  CreateTemplateResponse,
  DeleteTemplateResponse,
} from "../types/templates";

// Query key factory
export const templateKeys = {
  all: ["templates"] as const,
  lists: () => [...templateKeys.all, "list"] as const,
  list: () => [...templateKeys.lists()] as const,
  byCategory: (category: string) => [...templateKeys.all, "category", category] as const,
  details: () => [...templateKeys.all, "detail"] as const,
  detail: (id: string) => [...templateKeys.details(), id] as const,
};

// List all templates
export function useTemplates() {
  return useQuery({
    queryKey: templateKeys.list(),
    queryFn: async () => {
      return invoke<Template[]>("list_templates");
    },
  });
}

// List templates by category
export function useTemplatesByCategory(category: string) {
  return useQuery({
    queryKey: templateKeys.byCategory(category),
    queryFn: async () => {
      return invoke<Template[]>("list_templates_by_category", { category });
    },
    enabled: !!category,
  });
}

// Get single template
export function useTemplate(id: string | null) {
  return useQuery({
    queryKey: templateKeys.detail(id ?? ""),
    queryFn: async () => {
      if (!id) throw new Error("No template ID provided");
      return invoke<Template>("get_template", { id });
    },
    enabled: !!id,
  });
}

// Create template mutation
export function useCreateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateTemplateParams) => {
      return invoke<CreateTemplateResponse>("create_template", {
        title: params.title,
        prompt: params.prompt,
        template_text: params.template_text,
        icon: params.icon,
        category: params.category,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.all });
    },
  });
}

// Update template mutation
export function useUpdateTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: UpdateTemplateParams) => {
      return invoke<Template>("update_template", {
        id: params.id,
        title: params.title,
        prompt: params.prompt,
        template_text: params.template_text,
        icon: params.icon,
        category: params.category,
      });
    },
    onSuccess: (_data, params) => {
      queryClient.invalidateQueries({ queryKey: templateKeys.detail(params.id) });
      queryClient.invalidateQueries({ queryKey: templateKeys.lists() });
    },
  });
}

// Delete template mutation
export function useDeleteTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      return invoke<DeleteTemplateResponse>("delete_template", { id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: templateKeys.all });
    },
  });
}
