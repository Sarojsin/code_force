import { api } from '../api/client';
import { logger } from '../../utils';

interface SyncOperation {
  op_id: string;
  op_type: string;
  page_id: string;
  page_version: number;
  data: Record<string, unknown>;
}

export class DiarySyncService {
  private queue: SyncOperation[] = [];

  enqueue(op: SyncOperation): void {
    this.queue.push(op);
    logger.debug('DiarySyncService.enqueued', { op_id: op.op_id, op_type: op.op_type });
  }

  async flush(pageId: string): Promise<boolean> {
    if (this.queue.length === 0) return true;
    const ops = [...this.queue];
    this.queue = [];
    try {
      // Use the shared axios client: it carries the API baseURL (already
      // includes /api/v1) and the Authorization header via its interceptor.
      await api.post(`/diary/pages/${pageId}/operations`, { operations: ops });
      return true;
    } catch (error) {
      logger.error('DiarySyncService.flush error', error);
      this.queue = [...ops, ...this.queue];
      return false;
    }
  }

  queueSize(): number {
    return this.queue.length;
  }
}
