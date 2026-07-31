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
      const token = ''; // TODO: get from auth store
      const response = await fetch(`/api/v1/diary/pages/${pageId}/operations`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ operations: ops }),
      });
      if (!response.ok) {
        logger.error('DiarySyncService.flush failed', { status: response.status });
        this.queue = [...ops, ...this.queue];
        return false;
      }
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
