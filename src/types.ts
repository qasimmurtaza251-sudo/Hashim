export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  version: number;
  updatedAt: string;
  updatedBy: string;
}

export interface SyncLog {
  id: string;
  timestamp: string;
  type: 'client_sync' | 'peer_mutate' | 'reset' | 'conflict_resolved';
  message: string;
  details: string;
}

export interface QueuedChange {
  id: string; // queue item id
  actionType: 'create' | 'update' | 'delete';
  task: Task;
  clientBaseVersion: number;
  timestamp: string;
}

export interface Conflict {
  taskId: string;
  type: 'creation_clash' | 'concurrency_clash' | 'delete_clash';
  clientTask: Task;
  serverTask: Task;
  message: string;
}
