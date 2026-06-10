import React from 'react';
import { Task } from '../types';
import { AlertTriangle, Clock, CloudOff, Edit2, Trash2, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';

interface TaskCardProps {
  task: Task;
  isUnsynced: boolean;
  onEdit: (task: Task) => void;
  onDelete: (taskId: string) => void;
  onMove: (taskId: string, newStatus: 'todo' | 'in_progress' | 'done') => void;
}

export function TaskCard({ task, isUnsynced, onEdit, onDelete, onMove }: TaskCardProps) {
  const priorityColors = {
    low: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    medium: 'bg-amber-50 text-amber-700 border-amber-100',
    high: 'bg-rose-50 text-rose-700 border-rose-100'
  };

  return (
    <motion.div
      layoutId={`card-${task.id}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={`p-4 rounded-xl border bg-white shadow-xs hover:shadow-md transition-all relative ${
        isUnsynced ? 'border-amber-300 ring-2 ring-amber-100' : 'border-zinc-200'
      }`}
    >
      {/* Top badges and Statuses */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border uppercase tracking-wider font-semibold ${priorityColors[task.priority]}`}>
          {task.priority}
        </span>
        
        <div className="flex items-center gap-1.5">
          {isUnsynced ? (
            <span className="flex items-center gap-1 text-[11px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200" title="Offline changes waiting to sync">
              <CloudOff size={11} className="animate-pulse" />
              <span>Unsynced (Rev {task.version})</span>
            </span>
          ) : (
            <span className="text-[10px] font-mono font-medium text-zinc-400 bg-zinc-100 px-1.5 py-0.5 rounded">
              Rev {task.version}
            </span>
          )}
        </div>
      </div>

      {/* Task Content */}
      <h4 className="text-zinc-900 font-medium text-[14px] leading-tight mb-1">{task.title}</h4>
      <p className="text-zinc-500 text-[12px] line-clamp-2 leading-relaxed mb-4">{task.description}</p>

      {/* Footer Details: Last Updated By and Actions */}
      <div className="flex items-center justify-between border-t border-zinc-100 pt-3 mt-2 text-[11px] text-zinc-400">
        <div className="flex items-center gap-1 min-w-0">
          <Clock size={11} className="flex-shrink-0" />
          <span className="truncate">
            By <strong className="text-zinc-600">{task.updatedBy}</strong>
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(task)}
            className="p-1 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-50 rounded transition-colors"
            title="Edit Task"
          >
            <Edit2 size={13} />
          </button>
          <button
            onClick={() => onDelete(task.id)}
            className="p-1 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
            title="Delete Task"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Quick Move Trigger Buttons */}
      <div className="flex items-center gap-1 mt-3 border-t border-dashed border-zinc-100 pt-2 bg-zinc-50/50 p-1.5 rounded-lg -mx-1">
        <span className="text-[10px] text-zinc-400 uppercase font-mono mr-auto pl-1">Move To:</span>
        {task.status !== 'todo' && (
          <button
            onClick={() => onMove(task.id, 'todo')}
            className="px-1.5 py-0.5 text-[10px] font-medium rounded hover:bg-zinc-100 text-zinc-600 transition-colors"
          >
            Todo
          </button>
        )}
        {task.status !== 'in_progress' && (
          <button
            onClick={() => onMove(task.id, 'in_progress')}
            className="px-1.5 py-0.5 text-[10px] font-medium rounded hover:bg-zinc-100 text-zinc-600 transition-colors"
          >
            Active
          </button>
        )}
        {task.status !== 'done' && (
          <button
            onClick={() => onMove(task.id, 'done')}
            className="px-1.5 py-0.5 text-[10px] font-medium rounded hover:bg-zinc-100 text-zinc-600 transition-colors"
          >
            Done
          </button>
        )}
      </div>
    </motion.div>
  );
}
