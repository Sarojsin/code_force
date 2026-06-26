export interface PendingOperation {
  id: string;
  type: string;
  data: Record<string, unknown>;
  tempId?: string;
  idempotencyKey: string;
  clientUpdatedAt: string;
  createdAt: string;
  retryCount: number;
  maxRetries: number;
  priority: 'high' | 'normal';
}

export interface SyncResult {
  index: number;
  status: 'created' | 'updated' | 'deleted' | 'conflict' | 'failed';
  entity_id?: string;
  temp_id?: string;
  server_data?: Record<string, unknown>;
  error?: string;
}

export interface SyncBatchResponse {
  results: SyncResult[];
  conflicts: SyncResult[];
}

export interface SyncChangeItem {
  entity_type: string;
  entity_id: string;
  action: 'created' | 'updated' | 'deleted';
  data: Record<string, unknown>;
  updated_at: string;
}

export interface SyncChangesResponse {
  changes: SyncChangeItem[];
  has_more: boolean;
  next_token?: string;
}
