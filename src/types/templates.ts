export type TemplateCategory = "growth" | "mindfulness" | "morning" | "reflection";

export interface Template {
  id: string;
  title: string;
  prompt: string;
  template_text: string;
  icon: string | null;
  category: TemplateCategory;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateTemplateParams {
  title: string;
  prompt: string;
  template_text: string;
  icon?: string;
  category: TemplateCategory;
}

export interface UpdateTemplateParams {
  id: string;
  title?: string;
  prompt?: string;
  template_text?: string;
  icon?: string;
  category?: TemplateCategory;
}

export interface CreateTemplateResponse {
  status: string;
  id: string;
}

export interface DeleteTemplateResponse {
  success: boolean;
}

export const CATEGORY_LABELS: Record<TemplateCategory, string> = {
  growth: "Growth",
  mindfulness: "Mindfulness",
  morning: "Morning",
  reflection: "Reflection",
};

export const CATEGORY_ORDER: TemplateCategory[] = [
  "growth",
  "mindfulness",
  "morning",
  "reflection",
];
