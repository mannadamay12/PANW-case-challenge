export interface JournalEntry {
  id: string;
  content: string;
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
