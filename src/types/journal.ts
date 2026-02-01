export type EntryType = "morning" | "evening" | "gratitude" | "reflection";

export interface JournalEntry {
  id: string;
  content: string;
  title: string | null;
  entry_type: EntryType;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateEntryResponse {
  status: string;
  id: string;
}

export interface DeleteResponse {
  success: boolean;
}

export interface ListEntriesParams {
  limit?: number;
  offset?: number;
  archived?: boolean;
}

export interface SearchEntriesParams {
  query: string;
  limit?: number;
}

export interface CreateEntryParams {
  content: string;
  title?: string;
  entry_type?: EntryType;
}

export interface UpdateEntryParams {
  id: string;
  content?: string;
  title?: string;
  entry_type?: EntryType;
  created_at?: string;
}

export interface EntryImage {
  id: string;
  entry_id: string;
  filename: string;
  relative_path: string;
  mime_type: string | null;
  file_size: number | null;
  width: number | null;
  height: number | null;
  created_at: string;
}
