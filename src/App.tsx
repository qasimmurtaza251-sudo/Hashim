import React, { useState, useEffect, useRef } from 'react';
import { Task, QueuedChange, SyncLog, Conflict } from './types';
import { TaskCard } from './components/TaskCard';
import { ConflictModal } from './components/ConflictModal';
import { MockPeerPanel } from './components/MockPeerPanel';
import {
  Wifi,
  WifiOff,
  Plus,
  RefreshCw,
  Database,
  Terminal,
  RotateCcw,
  CheckCircle2,
  ListTodo,
  Columns,
  Sparkles,
  Info,
  Loader2,
  Laptop
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Generates a unique client ID stored in localStorage to distinguish client sessions
const getOrCreateClientId = () => {
  let id = localStorage.getItem('offline_workspace_client_id');
  if (!id) {
    id = `User-${Math.floor(1000 + Math.random() * 9000)}`;
    localStorage.setItem('offline_workspace_client_id', id);
  }
  return id;
};

export default function App() {
  const clientId = getOrCreateClientId();

  // State Management
  const [tasks, setTasks] = useState<Task[]>([]);
  const [offlineQueue, setOfflineQueue] = useState<QueuedChange[]>([]);
  const [serverLogs, setServerLogs] = useState<SyncLog[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  
  // Connectivity control (True = Simulator online, False = Simulated offline)
  const [isSimulatedOnline, setIsSimulatedOnline] = useState<boolean>(() => {
    const cached = localStorage.getItem('offline_workspace_connection');
    return cached !== 'offline';
  });
  
  // Real browser connectivity
  const [isBrowserOnline, setIsBrowserOnline] = useState<boolean>(navigator.onLine);
  
  // Active Connection calculated by combining Simulated state and actual browser API
  const isOnline = isSimulatedOnline && isBrowserOnline;

  // Loading and Interaction states
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  
  // Add Form Inputs
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [newStatus, setNewStatus] = useState<'todo' | 'in_progress' | 'done'>('todo');

  // Edit Task State
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Sync Interval Ref
  const autoSyncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Synchronize browser online event state
  useEffect(() => {
    const handleOnline = () => {
      setIsBrowserOnline(true);
      addLocalLog("System Network", "Network adapter detected online status.", "browser_event");
    };
    const handleOffline = () => {
      setIsBrowserOnline(false);
      addLocalLog("System Network", "Network adapter went completely offline.", "browser_event");
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Hydrate states from LocalStorage on mount
  useEffect(() => {
    const storedTasks = localStorage.getItem('offline_workspace_tasks');
    const storedQueue = localStorage.getItem('offline_workspace_queue');
    
    if (storedTasks) {
      setTasks(JSON.parse(storedTasks));
    }
    if (storedQueue) {
      setOfflineQueue(JSON.parse(storedQueue));
    }

    // Load dynamic server stats if online
    fetchInitialServerData();
  }, []);

  // Save state back to LocalStorage whenever changes happen locally
  useEffect(() => {
    localStorage.setItem('offline_workspace_tasks', JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem('offline_workspace_queue', JSON.stringify(offlineQueue));
  }, [offlineQueue]);

  // Handle auto-sync check on connection toggle
  useEffect(() => {
    localStorage.setItem('offline_workspace_connection', isSimulatedOnline ? 'online' : 'offline');
    
    if (isOnline) {
      addLocalLog("Connection State", "Session established online safely. Preparing synchronizer.", "info");
      triggerBackupSync();
    } else {
      addLocalLog("Connection State", "Disconnected. All active local changes will accumulate offline.", "warn");
    }
  }, [isSimulatedOnline, isBrowserOnline]);

  // Set up repeating background task synchronization when online (every 10 seconds)
  useEffect(() => {
    if (isOnline) {
      autoSyncIntervalRef.current = setInterval(() => {
        triggerBackupSync(true /* silent background sync */);
      }, 10000);
    } else {
      if (autoSyncIntervalRef.current) {
        clearInterval(autoSyncIntervalRef.current);
      }
    }

    return () => {
      if (autoSyncIntervalRef.current) {
        clearInterval(autoSyncIntervalRef.current);
      }
    };
  }, [isOnline, offlineQueue]);

  // App Logs (Local UI terminal activity)
  const [clientConsoleLogs, setClientConsoleLogs] = useState<Array<{
    time: string;
    category: string;
    text: string;
    type: 'info' | 'success' | 'warn' | 'error' | 'browser_event';
  }>>([
    {
      time: new Date().toLocaleTimeString(),
      category: "Bootloader",
      text: "Offline-First Synchronization Shell initialized.",
      type: "success"
    }
  ]);

  const addLocalLog = (category: string, text: string, type: 'info' | 'success' | 'warn' | 'error' | 'browser_event' = 'info') => {
    setClientConsoleLogs(prev => [
      {
        time: new Date().toLocaleTimeString(),
        category,
        text,
        type
      },
      ...prev.slice(0, 39) // cap logs at 40
    ]);
  };

  // API Call Helpers
  const fetchInitialServerData = async () => {
    if (!isOnline) {
      addLocalLog("Offline Loader", "Loaded existing cached models from browser storage.", "info");
      return;
    }
    
    setIsLoading(true);
    try {
      // Load current Server tasks
      const rTasks = await fetch("/api/tasks");
      const rLogs = await fetch("/api/logs");
      
      if (rTasks.ok && rLogs.ok) {
        const dTasks = await rTasks.json();
        const dLogs = await rLogs.json();
        
        setServerLogs(dLogs.logs);

        // If client queue is empty, match server tasks directly.
        // If client has offline changes, preserve the local optimistic tasks!
        if (offlineQueue.length === 0) {
          setTasks(dTasks.tasks);
          addLocalLog("Cloud Fetch", "Synchronized in-memory models live with cloud backend database.", "success");
        } else {
          addLocalLog("Cloud Fetch", `Discovered ${offlineQueue.length} unsynced local mutations. Keeping local state.`, "warn");
        }
      }
    } catch (e) {
      addLocalLog("Cloud Fetch", "Connection failed. Running client isolated.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Perform full server synchronization
  const triggerBackupSync = async (silent = false) => {
    if (!isOnline) {
      if (!silent) addLocalLog("Sync Trigger", "Action cancelled. Device is simulated offline.", "warn");
      return;
    }

    if (isSyncing) return;

    if (!silent) addLocalLog("Sync Engine", "Negotiating sync sequence with upstream server...", "info");
    setIsSyncing(true);

    try {
      const response = await fetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientChanges: offlineQueue,
          clientId: clientId
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.success) {
          // Success! Update tasks database, purge queue, clean conflicts
          setTasks(data.tasks);
          setOfflineQueue([]);
          setServerLogs(data.logs);
          setConflicts([]);
          addLocalLog("Sync Engine", `Successfully pushed & retrieved state! Purged offline queue.`, "success");
        } else {
          // Conflicts detected!
          if (data.conflicts && data.conflicts.length > 0) {
            setConflicts(data.conflicts);
            setTasks(data.tasks); // Reflect latest server tasks (some updates may have still gone through)
            addLocalLog("Sync Engine", `Synched completed safely, but found ${data.conflicts.length} direct concurrent conflict(s).`, "error");
          }
        }
      } else {
        addLocalLog("Sync Engine", "Synchronization network error encountered.", "error");
      }
    } catch (err) {
      addLocalLog("Sync Engine", "Backend communication timed out or unavailable.", "error");
    } finally {
      setIsSyncing(false);
    }
  };

  // Client Action creators (Optimistic updates!)
  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newTask: Task = {
      id: `task-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      title: newTitle.trim(),
      description: newDescription.trim(),
      status: newStatus,
      priority: newPriority,
      version: 1,
      updatedAt: new Date().toISOString(),
      updatedBy: clientId
    };

    // 1. Optimistic list append
    setTasks(prev => [newTask, ...prev]);

    // 2. Queue the action
    const newChange: QueuedChange = {
      id: `queue-${Date.now()}`,
      actionType: 'create',
      task: newTask,
      clientBaseVersion: 0,
      timestamp: new Date().toISOString()
    };
    setOfflineQueue(prev => [...prev, newChange]);
    addLocalLog("Task Create", `Task queued: "${newTask.title}" status "${newTask.status}"`, "info");

    // Close and reset form
    setNewTitle('');
    setNewDescription('');
    setShowAddForm(false);
  };

  // Quick Inline Status Relocate
  const handleMoveStatus = (taskId: string, newStatusValue: 'todo' | 'in_progress' | 'done') => {
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    if (taskIndex === -1) return;

    const oldTask = tasks[taskIndex];
    if (oldTask.status === newStatusValue) return;

    const updatedTask: Task = {
      ...oldTask,
      status: newStatusValue,
      updatedAt: new Date().toISOString(),
      updatedBy: clientId
    };

    // Update locally
    setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));

    // Register offline tracker queue
    // Optimization: If a 'create' action for this task is already in the queue, update that creator directly
    const queueIndex = offlineQueue.findIndex(q => q.task.id === taskId);
    if (queueIndex !== -1) {
      const existingQueueItem = offlineQueue[queueIndex];
      if (existingQueueItem.actionType === 'create') {
        setOfflineQueue(prev => prev.map((q, idx) => {
          if (idx === queueIndex) {
            return { ...q, task: updatedTask };
          }
          return q;
        }));
      } else {
        // Appends an update action
        const newChange: QueuedChange = {
          id: `queue-${Date.now()}`,
          actionType: 'update',
          task: updatedTask,
          clientBaseVersion: oldTask.version,
          timestamp: new Date().toISOString()
        };
        setOfflineQueue(prev => [...prev, newChange]);
      }
    } else {
      const newChange: QueuedChange = {
        id: `queue-${Date.now()}`,
        actionType: 'update',
        task: updatedTask,
        clientBaseVersion: oldTask.version,
        timestamp: new Date().toISOString()
      };
      setOfflineQueue(prev => [...prev, newChange]);
    }

    addLocalLog("Move Task", `Shifted status of "${oldTask.title}" to ${newStatusValue}`, "info");
  };

  // Open Edit Dialog
  const handleOpenEdit = (task: Task) => {
    setEditingTask(task);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask || !editingTask.title.trim()) return;

    const updatedTask: Task = {
      ...editingTask,
      updatedAt: new Date().toISOString(),
      updatedBy: clientId
    };

    setTasks(prev => prev.map(t => t.id === editingTask.id ? updatedTask : t));

    const queueIndex = offlineQueue.findIndex(q => q.task.id === editingTask.id);
    if (queueIndex !== -1 && offlineQueue[queueIndex].actionType === 'create') {
      // Modify original create queue item
      setOfflineQueue(prev => prev.map((q, idx) => {
        if (idx === queueIndex) {
          return { ...q, task: updatedTask };
        }
        return q;
      }));
    } else {
      // Append update changelog
      const newChange: QueuedChange = {
        id: `queue-${Date.now()}`,
        actionType: 'update',
        task: updatedTask,
        clientBaseVersion: editingTask.version,
        timestamp: new Date().toISOString()
      };
      setOfflineQueue(prev => [...prev, newChange]);
    }

    addLocalLog("Task Update", `Edited task content: "${updatedTask.title}"`, "info");
    setEditingTask(null);
  };

  // Delete Action
  const handleDeleteTask = (taskId: string) => {
    const target = tasks.find(t => t.id === taskId);
    if (!target) return;

    // Filter local display
    setTasks(prev => prev.filter(t => t.id !== taskId));

    // Remove from 'create' queues altogether if it hasn't landed on server yet
    const queueIndex = offlineQueue.findIndex(q => q.task.id === taskId);
    if (queueIndex !== -1 && offlineQueue[queueIndex].actionType === 'create') {
      setOfflineQueue(prev => prev.filter(q => q.task.id !== taskId));
    } else {
      // Land dynamic delete state representation in offline queue
      const newChange: QueuedChange = {
        id: `queue-${Date.now()}`,
        actionType: 'delete',
        task: target,
        clientBaseVersion: target.version,
        timestamp: new Date().toISOString()
      };
      setOfflineQueue(prev => [...prev, newChange]);
    }

    addLocalLog("Task Delete", `Removed task "${target.title}" (Queued delete request)`, "warn");
  };

  // Conflict Resolution Action
  const handleResolveConflict = async (
    taskId: string,
    resolutionType: 'keep_server' | 'keep_client' | 'merge',
    resolvedTask?: Task
  ) => {
    if (!isOnline) {
      addLocalLog("Conflict Fixer", "You must be online to execute manual database resolution.", "error");
      return;
    }

    try {
      const response = await fetch("/api/resolve-conflict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          taskId,
          resolutionType,
          resolvedTask,
          clientId
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        // Remove this conflict from our active modal queue
        setConflicts(prev => prev.filter(c => c.taskId !== taskId));
        
        // Assign server tasks
        setTasks(data.tasks);
        setServerLogs(data.logs);

        addLocalLog("Conflict Fixer", `Manually reconciled task ID "${taskId}" via "${resolutionType}" preference.`, "success");

        // If all resolved call sync again to finalize any leftovers
        if (conflicts.length <= 1) {
          // Clear queue since sync is fully accomplished
          setOfflineQueue([]);
        }
      }
    } catch (e) {
      addLocalLog("Conflict Fixer", "Failed to upload conflict resolution choice.", "error");
    }
  };

  // Trigger peer action Sarah
  const handleSarahAction = async (payload: any) => {
    if (!isOnline) {
      addLocalLog("Sarah External Simulator", "Task rejected. Isolated network forbids remote peer injections.", "error");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/mock-peer-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        const data = await response.json();
        setTasks(data.tasks);
        setServerLogs(data.logs);
        addLocalLog("Sarah Simulator", `Sarah applied ${payload.actionType} successfully on Central Database!`, "success");
      }
    } catch (e) {
      addLocalLog("Sarah Simulator", "Could not submit peer simulated action.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Restores all backend to pristine mock default values
  const handleResetWorkspace = async () => {
    if (!isOnline) {
      addLocalLog("Reset Cleaner", "You are.offline. Conntect online first to reset server backend values.", "error");
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await fetch("/api/reset", { method: "POST" });
      if (response.ok) {
        const data = await response.json();
        setTasks(data.tasks);
        setOfflineQueue([]);
        setServerLogs(data.logs);
        setConflicts([]);
        addLocalLog("System Reset", "Cloud server restabilized to default baseline Revision 1 tasks.", "success");
      }
    } catch (error) {
      addLocalLog("System Reset", "Failed to send reset instruction.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Columns for board display
  const columns = [
    { title: "Todo backlog", status: "todo", color: "bg-zinc-100 text-zinc-800 border-zinc-200" },
    { title: "Active focus", status: "in_progress", color: "bg-blue-50 text-blue-800 border-blue-200" },
    { title: "Completed done", status: "done", color: "bg-emerald-50 text-emerald-800 border-emerald-200" }
  ];

  return (
    <div className="min-h-screen bg-zinc-100 flex flex-col font-sans select-none antialiased text-zinc-800">
      
      {/* Top Banner Status Bar */}
      <div className={`p-4 transition-colors duration-300 ${
        isOnline ? 'bg-zinc-900 border-b border-zinc-800 text-white' : 'bg-amber-600 text-white shadow-md'
      }`}>
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-sm">
          
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl flex items-center justify-center ${isOnline ? 'bg-zinc-800 text-emerald-400' : 'bg-amber-700 text-amber-200'}`}>
              <Laptop size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold tracking-tight text-white text-[15px]">OFFLINE-SYNC WORKSPACE</h1>
                <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-wider">{clientId}</span>
              </div>
              <p className="text-xs text-zinc-300">Professional multi-peer transactional architecture</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Real browser offline status warning */}
            {!isBrowserOnline && (
              <span className="flex items-center gap-1.5 px-3 py-1 bg-rose-700 text-rose-100 border border-rose-600 rounded-lg text-xs font-semibold animate-pulse">
                <WifiOff size={13} />
                Browser Network Disconnected
              </span>
            )}

            {/* Connection Toggle Switch */}
            <div className="flex items-center gap-2 bg-white/10 p-1.5 rounded-xl border border-white/10">
              <span className="text-xs font-mono font-bold pl-2 pr-1 text-zinc-200">Device Simulator Mode:</span>
              <button
                onClick={() => setIsSimulatedOnline(true)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  isSimulatedOnline 
                    ? 'bg-emerald-500 text-zinc-950 shadow-sm'
                    : 'text-zinc-300 hover:bg-white/5'
                }`}
              >
                <span className="flex items-center gap-1">
                  <Wifi size={12} />
                  Online Link
                </span>
              </button>
              <button
                onClick={() => setIsSimulatedOnline(false)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  !isSimulatedOnline 
                    ? 'bg-amber-500 text-zinc-950 shadow-sm'
                    : 'text-zinc-300 hover:bg-white/5'
                }`}
              >
                <span className="flex items-center gap-1 animate-pulse">
                  <WifiOff size={12} />
                  Offline Sandbox
                </span>
              </button>
            </div>

            {/* Manual Sync Trigger button */}
            {isOnline && (
              <button
                onClick={() => triggerBackupSync()}
                disabled={isSyncing}
                className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
              >
                {isSyncing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                <span>Sync Queue ({offlineQueue.length})</span>
              </button>
            )}
          </div>

        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto w-full p-4 md:p-6 lg:p-8 flex-1 grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Sidebar Panel for Controls & System Logs */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Diagnostic Status Box */}
          <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs">
            <h3 className="text-xs uppercase tracking-wider font-mono font-bold text-zinc-400 mb-3 flex items-center gap-1.5">
              <Database size={13} /> Panel Instrumentation
            </h3>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between p-2.5 bg-zinc-50 rounded-lg">
                <span className="text-xs text-zinc-500">Sync Status</span>
                <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded ${
                  isOnline 
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                    : 'bg-amber-50 text-amber-700 border border-amber-100 animate-pulse'
                }`}>
                  {isOnline ? 'Online Synced' : 'Offline Queuing'}
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-zinc-50 rounded-lg">
                <span className="text-xs text-zinc-500">Unsynced Queue</span>
                <span className={`text-xs font-bold font-mono px-2.5 py-0.5 rounded-full ${
                  offlineQueue.length > 0 
                    ? 'bg-amber-100 text-amber-800' 
                    : 'bg-zinc-100 text-zinc-650'
                }`}>
                  {offlineQueue.length} edits waiting
                </span>
              </div>

              <div className="flex items-center justify-between p-2.5 bg-zinc-50 rounded-lg">
                <span className="text-xs text-zinc-500">Database Tasks</span>
                <span className="text-xs font-bold font-mono text-zinc-800">
                  {tasks.length} models
                </span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-zinc-100 flex gap-2">
              <button
                onClick={() => setShowAddForm(true)}
                className="flex-1 py-2 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Plus size={14} /> Add New Task
              </button>
              
              {isOnline && (
                <button
                  onClick={handleResetWorkspace}
                  title="Wipe Server and Reset Defaults"
                  className="p-2 border border-zinc-200 font-bold hover:bg-rose-50 hover:text-rose-600 text-zinc-600 rounded-xl transition-all"
                >
                  <RotateCcw size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Peer Sarah simulator trigger console */}
          <MockPeerPanel
            tasks={tasks}
            onTriggerPeerAction={handleSarahAction}
            isLoading={isLoading}
          />

          {/* Client Telemetry Console */}
          <div className="bg-zinc-950 rounded-2xl border border-zinc-900 p-4 shadow-lg text-white">
            <h3 className="text-xs font-semibold text-zinc-400 font-mono uppercase tracking-wider mb-3 flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-zinc-300">
                <Terminal size={12} className="text-emerald-400 animate-pulse" />
                <span>Client Telemetry Log</span>
              </div>
              <span className="text-[9px] bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-400">active</span>
            </h3>
            
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1 select-text scrollbar-thin scrollbar-thumb-zinc-800">
              {clientConsoleLogs.map((log, index) => (
                <div key={index} className="text-[10px] font-mono leading-relaxed border-b border-zinc-900 pb-1 pt-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-zinc-500">[{log.time}]</span>
                    <span className={`font-semibold ${
                      log.type === 'success' ? 'text-emerald-400' :
                      log.type === 'warn' ? 'text-amber-400' :
                      log.type === 'error' ? 'text-rose-400' :
                      log.type === 'browser_event' ? 'text-indigo-400' : 'text-blue-400'
                    }`}>({log.category})</span>
                  </div>
                  <p className="text-zinc-300 mt-0.5">{log.text}</p>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Content Column (Task Board Grid) */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* Quick Informational Notice on Architecture */}
          <div className="bg-white rounded-2xl border border-zinc-200 p-4 flex items-start gap-3.5 shadow-2xs">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl mt-0.5">
              <Info size={16} />
            </div>
            <div>
              <p className="text-xs text-zinc-700 leading-relaxed">
                <strong>Offline-First Synchronization:</strong> Offline modifications immediately perform optimistic mutations on the screen, then register in the persistent local buffer list. Once network status is <strong>Online Link</strong>, a synchronization process resolves edits chronologically. Any server revisions updated concurrently while other clients are offline are captured as real-time conflict objects, prompting manual field-level mergers dynamically!
              </p>
            </div>
          </div>

          {/* Active board columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {columns.map(col => {
              const colTasks = tasks.filter(t => t.status === col.status);
              
              return (
                <div key={col.status} className="bg-zinc-50 rounded-2xl border border-zinc-200/80 p-4 min-h-[450px] flex flex-col">
                  {/* Column Header */}
                  <div className="flex items-center justify-between mb-4 border-b border-zinc-200/80 pb-3">
                    <div className="flex items-center gap-2">
                      <span className={`text-[11px] font-bold font-mono uppercase px-2.5 py-0.5 rounded border ${col.color}`}>
                        {col.title}
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold text-zinc-400 bg-zinc-200/60 px-2 py-0.5 rounded-full">
                      {colTasks.length}
                    </span>
                  </div>

                  {/* Tasks List */}
                  <div className="flex-1 space-y-3">
                    <AnimatePresence initial={false}>
                      {colTasks.map(task => {
                        // Check if this task is stored as unsynced in the queue
                        const isUnsynced = offlineQueue.some(q => q.task.id === task.id);
                        
                        return (
                          <TaskCard
                            key={task.id}
                            task={task}
                            isUnsynced={isUnsynced}
                            onEdit={handleOpenEdit}
                            onDelete={handleDeleteTask}
                            onMove={handleMoveStatus}
                          />
                        );
                      })}
                    </AnimatePresence>

                    {colTasks.length === 0 && (
                      <div className="h-40 border border-dashed border-zinc-200 rounded-2xl flex flex-col items-center justify-center text-zinc-400 p-4 text-center">
                        <CheckCircle2 size={20} className="text-zinc-300 mb-1" />
                        <span className="text-[11px] font-medium font-mono uppercase">Empty Column</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Server Transaction Logs */}
          <div className="bg-white rounded-2xl border border-zinc-200 p-5 shadow-xs">
            <h3 className="text-xs uppercase tracking-wider font-mono font-bold text-zinc-400 mb-3 flex items-center gap-2">
              <Sparkles size={13} className="text-amber-500" />
              Central Cloud Server Audit Trail (Collaborative View)
            </h3>

            <div className="overflow-x-auto">
              <div className="min-w-full inline-block align-middle">
                {serverLogs.length === 0 ? (
                  <div className="py-4 text-center text-xs text-zinc-400 font-mono">
                    No sync telemetry records on server yet. Establish connection to post sync audits.
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-100 max-h-56 overflow-y-auto">
                    {serverLogs.map((sLog) => (
                      <div key={sLog.id} className="py-2.5 flex items-start gap-3 text-xs leading-relaxed">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-mono font-bold tracking-tight ${
                          sLog.type === 'client_sync' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                          sLog.type === 'peer_mutate' ? 'bg-orange-50 text-orange-700 border border-orange-100' :
                          sLog.type === 'conflict_resolved' ? 'bg-purple-100 text-purple-800' : 'bg-zinc-100 text-zinc-600'
                        }`}>
                          {sLog.type}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-zinc-800">{sLog.message}</p>
                          <p className="text-[11px] text-zinc-400 font-mono">{sLog.details}</p>
                        </div>
                        <span className="text-[10px] text-zinc-400 font-mono whitespace-nowrap">
                          {new Date(sLog.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* RENDER MODAL: Conflict Resolution Dialog */}
      {conflicts.length > 0 && (
        <ConflictModal
          conflict={conflicts[0]} // Resolve one by one
          onResolve={handleResolveConflict}
        />
      )}

      {/* RENDER MODAL: Create New Task Dialog */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-40">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl w-full max-w-md p-6 border border-zinc-200 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-100">
              <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-800">Create Workspace Task</h3>
              <button onClick={() => setShowAddForm(false)} className="text-zinc-400 hover:text-zinc-600 text-xs font-bold px-2 py-1 rounded hover:bg-zinc-50">
                Cancel
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="text-[10px] font-mono font-semibold uppercase tracking-wider text-zinc-400 block mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  placeholder="Design offline backup Adapter..."
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full text-xs p-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-850 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono font-semibold uppercase tracking-wider text-zinc-400 block mb-1">Task Context Context</label>
                <textarea
                  placeholder="Draft structural guidelines or references..."
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  rows={3}
                  className="w-full text-xs p-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-850 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono font-semibold uppercase tracking-wider text-zinc-400 block mb-1">Initial Status</label>
                  <select
                    value={newStatus}
                    onChange={(e: any) => setNewStatus(e.target.value)}
                    className="w-full text-xs p-2 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-850 focus:outline-none focus:ring-2 focus:ring-zinc-200"
                  >
                    <option value="todo">Todo backlog</option>
                    <option value="in_progress">Active focus</option>
                    <option value="done">Completed done</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-mono font-semibold uppercase tracking-wider text-zinc-400 block mb-1">Priority</label>
                  <select
                    value={newPriority}
                    onChange={(e: any) => setNewPriority(e.target.value)}
                    className="w-full text-xs p-2 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-850 focus:outline-none focus:ring-2 focus:ring-zinc-200"
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-850 text-white rounded-xl text-xs font-semibold cursor-pointer transition-all shadow-sm flex items-center justify-center gap-1.5"
              >
                <Plus size={14} />
                <span>Add Task Optimistically</span>
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {/* RENDER MODAL: Edit Task Dialog */}
      {editingTask && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-40">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl w-full max-w-md p-6 border border-zinc-200 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-100">
              <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-800">Edit Task Form</h3>
              <button onClick={() => setEditingTask(null)} className="text-zinc-400 hover:text-zinc-600 text-xs font-bold px-2 py-1 rounded hover:bg-zinc-50">
                Cancel
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="text-[10px] font-mono font-semibold uppercase tracking-wider text-zinc-400 block mb-1">Task Title *</label>
                <input
                  type="text"
                  required
                  value={editingTask.title}
                  onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                  className="w-full text-xs p-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-850 focus:outline-none focus:ring-2 focus:ring-zinc-200"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono font-semibold uppercase tracking-wider text-zinc-400 block mb-1">Task Description Context</label>
                <textarea
                  value={editingTask.description}
                  onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                  rows={3}
                  className="w-full text-xs p-2.5 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-850 focus:outline-none focus:ring-2 focus:ring-zinc-200"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-mono font-semibold uppercase tracking-wider text-zinc-400 block mb-1">Status Column</label>
                  <select
                    value={editingTask.status}
                    onChange={(e: any) => setEditingTask({ ...editingTask, status: e.target.value })}
                    className="w-full text-xs p-2 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-850 focus:outline-none focus:ring-2 focus:ring-zinc-200"
                  >
                    <option value="todo">Todo backlog</option>
                    <option value="in_progress">Active focus</option>
                    <option value="done">Completed done</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-mono font-semibold uppercase tracking-wider text-zinc-400 block mb-1">Priority</label>
                  <select
                    value={editingTask.priority}
                    onChange={(e: any) => setEditingTask({ ...editingTask, priority: e.target.value })}
                    className="w-full text-xs p-2 bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-850 focus:outline-none focus:ring-2 focus:ring-zinc-200"
                  >
                    <option value="low">Low Priority</option>
                    <option value="medium">Medium Priority</option>
                    <option value="high">High Priority</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 bg-zinc-900 hover:bg-zinc-850 text-white rounded-xl text-xs font-semibold cursor-pointer transition-all shadow-sm flex items-center justify-center gap-1.5"
              >
                <span>Save Local Modification</span>
              </button>
            </form>
          </motion.div>
        </div>
      )}

    </div>
  );
}
