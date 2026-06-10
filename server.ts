import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

interface Task {
  id: string;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  version: number;
  updatedAt: string;
  updatedBy: string;
}

interface SyncLog {
  id: string;
  timestamp: string;
  type: 'client_sync' | 'peer_mutate' | 'reset' | 'conflict_resolved';
  message: string;
  details: string;
}

// Global In-Memory Database (resets with server restart)
let tasks: Task[] = [
  {
    id: "task-1",
    title: "Design offline synchronization architecture",
    description: "Formulate protocol using client-side action queues and server version markers.",
    status: "in_progress",
    priority: "high",
    version: 1,
    updatedAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    updatedBy: "System"
  },
  {
    id: "task-2",
    title: "Implement IndexedDB local storage adapter",
    description: "Develop lightweight persistent backup layer for when client loses connection completely.",
    status: "todo",
    priority: "medium",
    version: 1,
    updatedAt: new Date(Date.now() - 3600000).toISOString(),
    updatedBy: "System"
  },
  {
    id: "task-3",
    title: "Optimize UI responsiveness under low-latency",
    description: "Test UX state transition metrics and handle optimistic local mutations seamlessly.",
    status: "done",
    priority: "low",
    version: 1,
    updatedAt: new Date(Date.now() - 1800000).toISOString(),
    updatedBy: "System"
  }
];

let syncLogs: SyncLog[] = [
  {
    id: "log-initial",
    timestamp: new Date().toISOString(),
    type: "reset",
    message: "Central Workspace Database Initialized",
    details: "Server booted with 3 baseline project tasks at Revision 1."
  }
];

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route: Healthcheck/Connectivity confirmation
  app.get("/api/health", (req, res) => {
    res.json({ online: true, timestamp: new Date().toISOString() });
  });

  // API Route: Fetch all tasks
  app.get("/api/tasks", (req, res) => {
    res.json({ tasks });
  });

  // API Route: Fetch sync activity logs
  app.get("/api/logs", (req, res) => {
    res.json({ logs: syncLogs });
  });

  // API Route: Reset server state
  app.post("/api/reset", (req, res) => {
    tasks = [
      {
        id: "task-1",
        title: "Design offline synchronization architecture",
        description: "Formulate protocol using client-side action queues and server version markers.",
        status: "in_progress",
        priority: "high",
        version: 1,
        updatedAt: new Date().toISOString(),
        updatedBy: "System"
      },
      {
        id: "task-2",
        title: "Implement IndexedDB local storage adapter",
        description: "Develop lightweight persistent backup layer for when client loses connection completely.",
        status: "todo",
        priority: "medium",
        version: 1,
        updatedAt: new Date().toISOString(),
        updatedBy: "System"
      },
      {
        id: "task-3",
        title: "Optimize UI responsiveness under low-latency",
        description: "Test UX state transition metrics and handle optimistic local mutations seamlessly.",
        status: "done",
        priority: "low",
        version: 1,
        updatedAt: new Date().toISOString(),
        updatedBy: "System"
      }
    ];

    syncLogs.unshift({
      id: "log-" + Date.now(),
      timestamp: new Date().toISOString(),
      type: "reset",
      message: "Workspace Reset to Baseline State",
      details: "All values restored to default, resetting tracking values to Revision 1."
    });

    res.json({ success: true, tasks, logs: syncLogs });
  });

  // API Route: Run simulated Peer changes ("Sarah") to trigger conflicts easily
  app.post("/api/mock-peer-actions", (req, res) => {
    const { actionType, taskId, title, description, status, priority } = req.body;
    
    if (actionType === 'update') {
      const taskIndex = tasks.findIndex(t => t.id === taskId);
      if (taskIndex !== -1) {
        const oldTask = tasks[taskIndex];
        const updated: Task = {
          ...oldTask,
          title: title !== undefined ? title : oldTask.title,
          description: description !== undefined ? description : oldTask.description,
          status: status !== undefined ? status : oldTask.status,
          priority: priority !== undefined ? priority : oldTask.priority,
          version: oldTask.version + 1,
          updatedAt: new Date().toISOString(),
          updatedBy: "Sarah (MOCK_PEER)"
        };
        tasks[taskIndex] = updated;

        syncLogs.unshift({
          id: "log-" + Date.now(),
          timestamp: new Date().toISOString(),
          type: "peer_mutate",
          message: `Peer "Sarah" updated task "${updated.title}"`,
          details: `Simulated external event. Shifted version ${oldTask.version} -> ${updated.version}. Status: "${updated.status}".`
        });
      }
    } else if (actionType === 'create') {
      const newTask: Task = {
        id: "task-" + Date.now(),
        title: title || "New Peer Task",
        description: description || "Injected from a remote workplace session.",
        status: status || "todo",
        priority: priority || "medium",
        version: 1,
        updatedAt: new Date().toISOString(),
        updatedBy: "Sarah (MOCK_PEER)"
      };
      tasks.push(newTask);

      syncLogs.unshift({
        id: "log-" + Date.now(),
        timestamp: new Date().toISOString(),
        type: "peer_mutate",
        message: `Peer "Sarah" created task "${newTask.title}"`,
        details: `Simulated remote task creation. Appended with Revision 1.`
      });
    }

    res.json({ success: true, tasks, logs: syncLogs });
  });

  // API Route: Dynamic Conflict-aware Batch Sync Endpoint
  // Receives: { clientChanges: Array<{ actionType, task: Task, clientBaseVersion: number }> }
  app.post("/api/sync", (req, res) => {
    const { clientChanges, clientId } = req.body;
    const clientName = clientId || "Client Session";
    const processedConflicts: any[] = [];
    const successfulUpdates: string[] = [];

    if (Array.isArray(clientChanges) && clientChanges.length > 0) {
      for (const change of clientChanges) {
        const { actionType, task } = change;
        
        if (actionType === 'create') {
          // New task created offline. If it already exists on server, skip (or update).
          const existIndex = tasks.findIndex(t => t.id === task.id);
          if (existIndex === -1) {
            const newTask: Task = {
              ...task,
              version: 1,
              updatedAt: new Date().toISOString(),
              updatedBy: clientName
            };
            tasks.push(newTask);
            successfulUpdates.push(`Created task "${task.title}"`);
          } else {
            // Task already exists, treat as conflict or update
            const serverTask = tasks[existIndex];
            processedConflicts.push({
              taskId: task.id,
              type: 'creation_clash',
              clientTask: task,
              serverTask,
              message: "Task with this ID already occupies server storage."
            });
          }
        } else if (actionType === 'update') {
          const serverIndex = tasks.findIndex(t => t.id === task.id);
          
          if (serverIndex === -1) {
            // Task deleted on server, but client updated it? Or task not found.
            // Let's create it back as a resolution, or flag it.
            const restoredTask: Task = {
              ...task,
              version: 1,
              updatedAt: new Date().toISOString(),
              updatedBy: clientName
            };
            tasks.push(restoredTask);
            successfulUpdates.push(`Restored deleted task "${task.title}"`);
          } else {
            const serverTask = tasks[serverIndex];
            
            // Check for conflict: If server version is greater than client's initial baseline version
            if (serverTask.version > change.clientBaseVersion) {
              // CONFLICT DETECTED!
              // If title, desc, status, and priority match, it's a non-conflicting version bump.
              const isIdentical = 
                serverTask.title === task.title && 
                serverTask.description === task.description && 
                serverTask.status === task.status && 
                serverTask.priority === task.priority;
                
              if (isIdentical) {
                // Silently align version
                continue;
              }

              processedConflicts.push({
                taskId: task.id,
                type: 'concurrency_clash',
                clientTask: task,
                serverTask,
                message: `Task was modified by "${serverTask.updatedBy}" (Rev ${serverTask.version}) while you were offline (Rev ${change.clientBaseVersion}).`
              });
            } else {
              // Apply change safely
              const updatedTask: Task = {
                ...task,
                version: serverTask.version + 1,
                updatedAt: new Date().toISOString(),
                updatedBy: clientName
              };
              tasks[serverIndex] = updatedTask;
              successfulUpdates.push(`Updated "${task.title}" to Rev ${updatedTask.version}`);
            }
          }
        } else if (actionType === 'delete') {
          const serverIndex = tasks.findIndex(t => t.id === task.id);
          if (serverIndex !== -1) {
            const serverTask = tasks[serverIndex];
            // If server has a newer version, flag as delete-clash
            if (serverTask.version > change.clientBaseVersion) {
              processedConflicts.push({
                taskId: task.id,
                type: 'delete_clash',
                clientTask: task,
                serverTask,
                message: `Task was updated by "${serverTask.updatedBy}" while offline. Confirm deletion.`
              });
            } else {
              tasks.splice(serverIndex, 1);
              successfulUpdates.push(`Removed task "${task.title}"`);
            }
          }
        }
      }

      // Record logs for successful transfers
      if (successfulUpdates.length > 0) {
        syncLogs.unshift({
          id: "log-" + Date.now(),
          timestamp: new Date().toISOString(),
          type: "client_sync",
          message: `${clientName} synced ${successfulUpdates.length} action(s)`,
          details: successfulUpdates.join(", ")
        });
      }
    }

    res.json({
      success: processedConflicts.length === 0,
      tasks,
      conflicts: processedConflicts,
      logs: syncLogs
    });
  });

  // API Route: Handle deliberate Force Resolution choice
  app.post("/api/resolve-conflict", (req, res) => {
    const { taskId, resolutionType, resolvedTask, clientId } = req.body;
    const clientName = clientId || "Client Session";
    const serverIndex = tasks.findIndex(t => t.id === taskId);

    if (resolutionType === 'keep_client' && resolvedTask) {
      if (serverIndex !== -1) {
        const previous = tasks[serverIndex];
        const nextTask: Task = {
          ...resolvedTask,
          version: previous.version + 1,
          updatedAt: new Date().toISOString(),
          updatedBy: clientName
        };
        tasks[serverIndex] = nextTask;
        syncLogs.unshift({
          id: "log-" + Date.now(),
          timestamp: new Date().toISOString(),
          type: "conflict_resolved",
          message: `Conflict resolved: Client preference kept for "${nextTask.title}"`,
          details: `Client forced local state. Resolution Rev ${nextTask.version} set.`
        });
      } else {
        // Task not found on server, create it
        const nextTask: Task = {
          ...resolvedTask,
          version: 1,
          updatedAt: new Date().toISOString(),
          updatedBy: clientName
        };
        tasks.push(nextTask);
      }
    } else if (resolutionType === 'keep_server') {
      if (serverIndex !== -1) {
        const serverTask = tasks[serverIndex];
        syncLogs.unshift({
          id: "log-" + Date.now(),
          timestamp: new Date().toISOString(),
          type: "conflict_resolved",
          message: `Conflict resolved: Server version kept for "${serverTask.title}"`,
          details: `Client synchronized back to server state at Rev ${serverTask.version}.`
        });
      }
    } else if (resolutionType === 'merge' && resolvedTask) {
      if (serverIndex !== -1) {
        const previous = tasks[serverIndex];
        const nextTask: Task = {
          ...resolvedTask,
          version: previous.version + 1,
          updatedAt: new Date().toISOString(),
          updatedBy: `${clientName} (Merged)`
        };
        tasks[serverIndex] = nextTask;
        syncLogs.unshift({
          id: "log-" + Date.now(),
          timestamp: new Date().toISOString(),
          type: "conflict_resolved",
          message: `Conflict resolved: Merged custom variables for "${nextTask.title}"`,
          details: `Created merged revision Rev ${nextTask.version}.`
        });
      }
    }

    res.json({ success: true, tasks, logs: syncLogs });
  });

  // Vite Integration Setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
