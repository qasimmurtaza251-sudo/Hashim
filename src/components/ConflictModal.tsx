import React, { useState } from 'react';
import { Conflict, Task } from '../types';
import { AlertCircle, Check, ShieldAlert, ArrowRight, CornerRightDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface ConflictModalProps {
  conflict: Conflict;
  onResolve: (taskId: string, resolutionType: 'keep_server' | 'keep_client' | 'merge', resolvedTask?: Task) => void;
}

export function ConflictModal({ conflict, onResolve }: ConflictModalProps) {
  const { clientTask, serverTask, message } = conflict;

  // Track state for dynamic field-level merging
  const [selectedTitle, setSelectedTitle] = useState<'server' | 'client'>('client');
  const [selectedDesc, setSelectedDesc] = useState<'server' | 'client'>('client');
  const [selectedStatus, setSelectedStatus] = useState<'server' | 'client'>('client');
  const [selectedPriority, setSelectedPriority] = useState<'server' | 'client'>('client');

  const mergedTask: Task = {
    ...clientTask,
    title: selectedTitle === 'server' ? serverTask.title : clientTask.title,
    description: selectedDesc === 'server' ? serverTask.description : clientTask.description,
    status: selectedStatus === 'server' ? serverTask.status : clientTask.status,
    priority: selectedPriority === 'server' ? serverTask.priority : clientTask.priority,
  };

  const hasDiffTitle = serverTask.title !== clientTask.title;
  const hasDiffDesc = serverTask.description !== clientTask.description;
  const hasDiffStatus = serverTask.status !== clientTask.status;
  const hasDiffPriority = serverTask.priority !== clientTask.priority;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-zinc-200 overflow-hidden"
      >
        {/* Modal Header */}
        <div className="bg-rose-50 border-b border-rose-100 p-5 flex items-start gap-4">
          <div className="p-3 bg-rose-500 text-white rounded-xl">
            <ShieldAlert size={24} />
          </div>
          <div>
            <span className="text-xs uppercase font-mono font-bold tracking-wider text-rose-500">
              Database Collision Identified
            </span>
            <h3 className="text-zinc-900 font-semibold text-lg leading-snug">
              Sync Conflict for "{serverTask.title}"
            </h3>
            <p className="text-rose-700 text-xs mt-1 font-medium leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        {/* Comparison grid */}
        <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 border-b border-zinc-100 bg-zinc-50/50">
          
          {/* Column 1: Server State */}
          <div className="space-y-4 bg-white p-4 rounded-xl border border-zinc-200 shadow-xs relative">
            <div className="absolute top-3 right-3 px-2 py-0.5 bg-zinc-100 border border-zinc-200 rounded text-[10px] font-semibold text-zinc-600 uppercase">
              Server State
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 uppercase font-mono tracking-wider">Storage Revision</span>
              <p className="text-sm font-semibold text-zinc-800 font-mono">Rev {serverTask.version}</p>
            </div>
            
            <div className="space-y-3 pt-2">
              <div>
                <label className="text-[10px] text-zinc-400 uppercase font-mono">Title</label>
                <div className={`p-2 rounded text-xs font-semibold ${hasDiffTitle ? 'bg-amber-50 text-amber-900' : 'text-zinc-700 bg-zinc-50'}`}>
                  {serverTask.title}
                </div>
              </div>
              <div>
                <label className="text-[10px] text-zinc-400 uppercase font-mono">Description</label>
                <div className={`p-2 rounded text-xs whitespace-pre-wrap leading-relaxed ${hasDiffDesc ? 'bg-amber-50 text-amber-900' : 'text-zinc-600 bg-zinc-50'}`}>
                  {serverTask.description}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-zinc-400 uppercase font-mono">Status</label>
                  <div className={`p-2 rounded text-center text-xs font-semibold ${hasDiffStatus ? 'bg-amber-50 text-amber-900' : 'text-zinc-700 bg-zinc-50'}`}>
                    {serverTask.status}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-zinc-400 uppercase font-mono">Priority</label>
                  <div className={`p-2 rounded text-center text-xs font-semibold ${hasDiffPriority ? 'bg-amber-50 text-amber-900' : 'text-zinc-700 bg-zinc-50'}`}>
                    {serverTask.priority}
                  </div>
                </div>
              </div>
              <div className="text-[11px] text-zinc-400 pt-2 border-t border-zinc-100">
                Last modified by <strong className="text-zinc-700">{serverTask.updatedBy}</strong> at {new Date(serverTask.updatedAt).toLocaleTimeString()}
              </div>
            </div>

            <button
              onClick={() => onResolve(serverTask.id, 'keep_server')}
              className="w-full mt-4 py-2 border border-blue-200 hover:border-blue-500 text-blue-600 hover:bg-blue-50/50 text-xs font-medium rounded-lg transition-all"
            >
              Keep Server Version Only
            </button>
          </div>

          {/* Column 2: Local Client (Offline Changes) */}
          <div className="space-y-4 bg-white p-4 rounded-xl border border-zinc-200 shadow-xs relative">
            <div className="absolute top-3 right-3 px-2 py-0.5 bg-amber-50 border border-amber-200 rounded text-[10px] font-semibold text-amber-600 uppercase">
              Your Offline Work
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 uppercase font-mono tracking-wider">Unsynced Revision</span>
              <p className="text-sm font-semibold text-zinc-800 font-mono">Rev {clientTask.version}</p>
            </div>

            <div className="space-y-3 pt-2">
              <div>
                <label className="text-[10px] text-zinc-400 uppercase font-mono">Title</label>
                <div className={`p-2 rounded text-xs font-semibold ${hasDiffTitle ? 'bg-amber-50 text-amber-900 font-medium' : 'text-zinc-700 bg-zinc-50'}`}>
                  {clientTask.title}
                </div>
              </div>
              <div>
                <label className="text-[10px] text-zinc-400 uppercase font-mono">Description</label>
                <div className={`p-2 rounded text-xs whitespace-pre-wrap leading-relaxed ${hasDiffDesc ? 'bg-amber-50 text-amber-900' : 'text-zinc-600 bg-zinc-50'}`}>
                  {clientTask.description}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-zinc-400 uppercase font-mono">Status</label>
                  <div className={`p-2 rounded text-center text-xs font-semibold ${hasDiffStatus ? 'bg-amber-50 text-amber-900' : 'text-zinc-700 bg-zinc-50'}`}>
                    {clientTask.status}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-zinc-400 uppercase font-mono">Priority</label>
                  <div className={`p-2 rounded text-center text-xs font-semibold ${hasDiffPriority ? 'bg-amber-50 text-amber-900' : 'text-zinc-700 bg-zinc-50'}`}>
                    {clientTask.priority}
                  </div>
                </div>
              </div>
              <div className="text-[11px] text-zinc-400 pt-2 border-t border-zinc-100">
                Created offline during network disconnection
              </div>
            </div>

            <button
              onClick={() => onResolve(clientTask.id, 'keep_client', clientTask)}
              className="w-full mt-4 py-2 border border-amber-200 hover:border-amber-500 text-amber-700 hover:bg-amber-50/50 text-xs font-medium rounded-lg transition-all"
            >
              Keep My Local Version & Overwrite
            </button>
          </div>

          {/* Column 3: Custom Field-by-Field Merge Playground */}
          <div className="space-y-4 bg-zinc-900 p-4 rounded-xl border border-zinc-800 shadow-md text-white relative">
            <div className="absolute top-3 right-3 px-2 py-0.5 bg-yellow-500/20 border border-yellow-500/40 rounded text-[10px] font-semibold text-yellow-400 uppercase">
              Field Merger
            </div>
            <div>
              <span className="text-[10px] text-zinc-400 uppercase font-mono tracking-wider">Resolution Choice</span>
              <p className="text-sm font-semibold text-yellow-400 font-mono">Interactive Fusion</p>
            </div>

            <div className="space-y-3 pt-2">
              {/* Merge Title */}
              <div>
                <label className="text-[10px] text-zinc-400 uppercase font-mono block mb-1">Pick Title</label>
                <div className="grid grid-cols-2 gap-1 font-mono text-[10px]">
                  <button
                    onClick={() => setSelectedTitle('server')}
                    className={`p-1 truncate rounded border transition-colors ${selectedTitle === 'server' ? 'bg-white text-zinc-900 border-white font-bold' : 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}
                  >
                    Server: {serverTask.title}
                  </button>
                  <button
                    onClick={() => setSelectedTitle('client')}
                    className={`p-1 truncate rounded border transition-colors ${selectedTitle === 'client' ? 'bg-white text-zinc-900 border-white font-bold' : 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}
                  >
                    Client: {clientTask.title}
                  </button>
                </div>
              </div>

              {/* Merge Description */}
              <div>
                <label className="text-[10px] text-zinc-400 uppercase font-mono block mb-1">Pick Description</label>
                <div className="grid grid-cols-2 gap-1 font-mono text-[10px]">
                  <button
                    onClick={() => setSelectedDesc('server')}
                    className={`p-1 truncate rounded border transition-colors ${selectedDesc === 'server' ? 'bg-white text-zinc-900 border-white font-bold' : 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}
                  >
                    Server Text
                  </button>
                  <button
                    onClick={() => setSelectedDesc('client')}
                    className={`p-1 truncate rounded border transition-colors ${selectedDesc === 'client' ? 'bg-white text-zinc-900 border-white font-bold' : 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}
                  >
                    Client Text
                  </button>
                </div>
              </div>

              {/* Merge Status */}
              <div>
                <label className="text-[10px] text-zinc-400 uppercase font-mono block mb-1">Pick Status</label>
                <div className="grid grid-cols-2 gap-1 font-mono text-[10px]">
                  <button
                    onClick={() => setSelectedStatus('server')}
                    className={`p-1 rounded border transition-colors ${selectedStatus === 'server' ? 'bg-white text-zinc-900 border-white font-bold' : 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}
                  >
                    Server: {serverTask.status}
                  </button>
                  <button
                    onClick={() => setSelectedStatus('client')}
                    className={`p-1 rounded border transition-colors ${selectedStatus === 'client' ? 'bg-white text-zinc-900 border-white font-bold' : 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}
                  >
                    Client: {clientTask.status}
                  </button>
                </div>
              </div>

              {/* Merge Priority */}
              <div>
                <label className="text-[10px] text-zinc-400 uppercase font-mono block mb-1">Pick Priority</label>
                <div className="grid grid-cols-2 gap-1 font-mono text-[10px]">
                  <button
                    onClick={() => setSelectedPriority('server')}
                    className={`p-1 rounded border transition-colors ${selectedPriority === 'server' ? 'bg-white text-zinc-900 border-white font-bold' : 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}
                  >
                    Server: {serverTask.priority}
                  </button>
                  <button
                    onClick={() => setSelectedPriority('client')}
                    className={`p-1 rounded border transition-colors ${selectedPriority === 'client' ? 'bg-white text-zinc-900 border-white font-bold' : 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}
                  >
                    Client: {clientTask.priority}
                  </button>
                </div>
              </div>

              {/* Merged Preview Outcome */}
              <div className="bg-zinc-800 p-2.5 rounded-lg border border-zinc-700 mt-2">
                <span className="text-[9px] text-yellow-400 font-semibold block uppercase tracking-wider font-mono">Merged Result Preview</span>
                <p className="text-xs font-bold text-zinc-100 truncate mt-0.5">{mergedTask.title}</p>
                <p className="text-[10px] text-zinc-400 line-clamp-1">{mergedTask.description}</p>
                <div className="flex gap-2 text-[9px] mt-1 text-zinc-500 font-mono">
                  <span>Status: {mergedTask.status}</span>
                  <span>•</span>
                  <span>Priority: {mergedTask.priority}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => onResolve(clientTask.id, 'merge', mergedTask)}
              className="w-full mt-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-zinc-905 text-xs font-bold rounded-lg transition-all"
            >
              Merge and Upload
            </button>
          </div>

        </div>

        {/* Modal Footer explanation */}
        <div className="bg-zinc-100 px-6 py-4 flex items-center justify-between text-xs text-zinc-500">
          <span className="flex items-center gap-1">
            <AlertCircle size={13} className="text-zinc-400" />
            Every resolution automatically locks in a new incremental version revision on the server database.
          </span>
        </div>
      </motion.div>
    </div>
  );
}
