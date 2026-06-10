import React, { useState } from 'react';
import { Task } from '../types';
import { User, Send, Settings, Check, HelpCircle, Activity } from 'lucide-react';

interface MockPeerPanelProps {
  tasks: Task[];
  onTriggerPeerAction: (payload: {
    actionType: 'create' | 'update';
    taskId?: string;
    title?: string;
    description?: string;
    status?: 'todo' | 'in_progress' | 'done';
    priority?: 'low' | 'medium' | 'high';
  }) => void;
  isLoading: boolean;
}

export function MockPeerPanel({ tasks, onTriggerPeerAction, isLoading }: MockPeerPanelProps) {
  const [actionType, setActionType] = useState<'create' | 'update'>('update');
  const [selectedTaskId, setSelectedTaskId] = useState<string>(tasks[0]?.id || '');
  
  // States for mutation fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'todo' | 'in_progress' | 'done'>('todo');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');

  // Load task values when selected task changes for the mutation action helper
  const handleSelectTask = (id: string) => {
    setSelectedTaskId(id);
    const found = tasks.find(t => t.id === id);
    if (found) {
      setTitle(found.title);
      setDescription(found.description);
      setStatus(found.status);
      setPriority(found.priority);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (actionType === 'update' && !selectedTaskId) return;
    
    onTriggerPeerAction({
      actionType,
      taskId: actionType === 'update' ? selectedTaskId : undefined,
      title: title || undefined,
      description: description || undefined,
      status: status || undefined,
      priority: priority || undefined
    });

    // Clear form
    if (actionType === 'create') {
      setTitle('');
      setDescription('');
    }
  };

  return (
    <div className="bg-zinc-50 border border-zinc-200 rounded-2xl p-5 shadow-xs">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 bg-orange-100 text-orange-600 rounded-lg">
          <User size={16} />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-zinc-900 leading-none">Sarah's Remote Session</h3>
          <span className="text-[10px] text-zinc-500 font-medium">Simulated Collaborative Node</span>
        </div>
      </div>

      <div className="bg-orange-50/50 rounded-xl p-3 border border-orange-100 text-xs text-orange-850 space-y-1 mb-4 leading-relaxed">
        <p className="font-semibold flex items-center gap-1">
          <Activity size={12} className="text-orange-500 animate-pulse" />
          Test Dynamic Sync Conflicts:
        </p>
        <ol className="list-decimal pl-4 space-y-1 text-[11px] text-orange-800">
          <li>Toggle your workplace connection option to <strong>Offline</strong>.</li>
          <li>Edit a task's title/status in the columns below (changes saved locally).</li>
          <li>Use this console to edit the <em>same task</em> on the central server as <strong>Sarah</strong>.</li>
          <li>Toggle your status back to <strong>Online</strong> to trigger the conflict resolver!</li>
        </ol>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Toggle between creation and mutation */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-zinc-200/60 rounded-lg">
          <button
            type="button"
            onClick={() => {
              setActionType('update');
              if (tasks.length > 0) handleSelectTask(tasks[0].id);
            }}
            className={`py-1 text-xs font-semibold rounded-md transition-all ${
              actionType === 'update'
                ? 'bg-white text-zinc-900 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-700'
            }`}
          >
            Mutate Existing
          </button>
          <button
            type="button"
            onClick={() => {
              setActionType('create');
              setTitle('');
              setDescription('');
            }}
            className={`py-1 text-xs font-semibold rounded-md transition-all ${
              actionType === 'create'
                ? 'bg-white text-zinc-900 shadow-xs'
                : 'text-zinc-500 hover:text-zinc-700'
            }`}
          >
            Create Brand New
          </button>
        </div>

        {/* If updating, pick which existing task to mutate */}
        {actionType === 'update' && (
          <div className="space-y-1">
            <label className="text-[10px] font-mono font-semibold uppercase tracking-wider text-zinc-400">Select Server Task</label>
            <select
              value={selectedTaskId}
              onChange={(e) => handleSelectTask(e.target.value)}
              className="w-full text-xs p-2 bg-white border border-zinc-200 rounded-lg text-zinc-800 focus:outline-none focus:ring-2 focus:ring-orange-200"
            >
              <option value="" disabled>-- Select a task --</option>
              {tasks.map(t => (
                <option key={t.id} value={t.id}>
                  {t.title} (Rev {t.version})
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Mutation fields */}
        <div className="space-y-2 pt-1 border-t border-dashed border-zinc-200">
          <div>
            <label className="text-[10px] font-mono font-semibold uppercase tracking-wider text-zinc-400">Task Title</label>
            <input
              type="text"
              required
              placeholder={actionType === 'create' ? "Analyze security constraints..." : "Update title"}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full text-xs p-2 bg-white border border-zinc-200 rounded-lg text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-orange-200 shadow-2xs"
            />
          </div>

          <div>
            <label className="text-[10px] font-mono font-semibold uppercase tracking-wider text-zinc-400">Description</label>
            <textarea
              placeholder="Provide context for the peer change"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full text-xs p-2 bg-white border border-zinc-200 rounded-lg text-zinc-800 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-orange-200"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] font-mono font-semibold uppercase tracking-wider text-zinc-400">Column Status</label>
              <select
                value={status}
                onChange={(e: any) => setStatus(e.target.value)}
                className="w-full text-xs p-2 bg-white border border-zinc-200 rounded-lg text-zinc-800 focus:outline-none focus:ring-2 focus:ring-orange-200"
              >
                <option value="todo">Todo Column</option>
                <option value="in_progress">Active Column</option>
                <option value="done">Done Column</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-mono font-semibold uppercase tracking-wider text-zinc-400">Priority Level</label>
              <select
                value={priority}
                onChange={(e: any) => setPriority(e.target.value)}
                className="w-full text-xs p-2 bg-white border border-zinc-200 rounded-lg text-zinc-800 focus:outline-none focus:ring-2 focus:ring-orange-200"
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
              </select>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading || (actionType === 'update' && !selectedTaskId)}
          className="w-full py-2 bg-zinc-900 border border-zinc-800 text-white rounded-xl text-xs font-semibold hover:bg-zinc-800 transition-colors shadow-sm cursor-pointer hover:shadow-md disabled:bg-zinc-300 disabled:border-zinc-300 flex items-center justify-center gap-1"
        >
          <Send size={12} />
          <span>{actionType === 'update' ? "Apply Mutate as Sarah" : "Insert Task as Sarah"}</span>
        </button>
      </form>
    </div>
  );
}
