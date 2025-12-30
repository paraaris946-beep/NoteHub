
import React, { useState, useRef, useEffect } from 'react';
import { Task } from '../types';
import { 
  CheckCircle, 
  Circle, 
  Clock, 
  Trash2, 
  X, 
  Star, 
  Camera, 
  Image as ImageIcon, 
  Maximize2,
  Bell,
  Edit2,
  Check,
  Zap
} from 'lucide-react';

interface TaskItemProps {
  task: Task;
  onToggle: (id: string) => void;
  onToggleImportant?: (id: string) => void;
  onDelete: (id: string) => void;
  onUpdate?: (id: string, updates: Partial<Task>) => void;
}

const TaskItem: React.FC<TaskItemProps> = ({ task, onToggle, onToggleImportant, onDelete, onUpdate }) => {
  const [isConfirming, setIsConfirming] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(task.title);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const priorityMenuRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const priorityConfig = {
    high: { 
      id: 'high' as const,
      label: 'Hoch',
      symbol: '!', 
      color: 'text-red-500 bg-red-50 dark:bg-red-900/30 border-red-100 dark:border-red-800/50' 
    },
    medium: { 
      id: 'medium' as const,
      label: 'Mittel',
      symbol: '?', 
      color: 'text-amber-500 bg-amber-50 dark:bg-amber-900/30 border-amber-100 dark:border-amber-800/50' 
    },
    low: { 
      id: 'low' as const,
      label: 'Niedrig',
      symbol: '.', 
      color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/30 border-blue-100 dark:border-blue-800/50' 
    }
  };

  const currentPriority = priorityConfig[task.priority];

  useEffect(() => {
    if (isEditing && editInputRef.current) {
      editInputRef.current.focus();
      // Cursor ans Ende setzen
      const len = editInputRef.current.value.length;
      editInputRef.current.setSelectionRange(len, len);
    }
  }, [isEditing]);

  const handleSaveEdit = () => {
    const trimmed = editedTitle.trim();
    if (trimmed && onUpdate) {
      onUpdate(task.id, { title: trimmed });
    } else {
      setEditedTitle(task.title);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveEdit();
    }
    if (e.key === 'Escape') {
      setEditedTitle(task.title);
      setIsEditing(false);
    }
  };

  const handleStartEditing = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!task.completed) {
      setEditedTitle(task.title);
      setIsEditing(true);
    }
  };

  return (
    <>
      <div className={`
        relative flex flex-col p-4 rounded-[2rem] transition-all border-2 overflow-visible
        ${task.isImportant && !task.completed 
          ? 'border-amber-200 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-900/10 shadow-lg' 
          : 'border-transparent shadow-sm hover:border-slate-100 dark:hover:border-slate-800 bg-white dark:bg-slate-900'
        }
        ${task.completed ? 'bg-slate-50 dark:bg-slate-950 opacity-60 border-transparent' : ''}
      `}>
        <div className="flex items-start justify-between w-full gap-2">
          {/* Checkbox */}
          <button onClick={() => onToggle(task.id)} className="mt-1 text-slate-300 dark:text-slate-700 hover:text-green-500 transition-all active:scale-90 shrink-0">
            {task.completed ? <CheckCircle className="w-6 h-6 text-green-500" /> : <Circle className="w-6 h-6" />}
          </button>
          
          <div className="flex flex-col flex-1 min-w-0">
            <div className="flex items-start gap-2 group min-h-[1.5rem]">
              {isEditing ? (
                <div className="flex-1 flex items-center gap-1 min-w-0 bg-slate-50 dark:bg-slate-800 rounded-xl p-1 border border-indigo-500/30">
                  <input
                    ref={editInputRef}
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    onBlur={handleSaveEdit}
                    onKeyDown={handleKeyDown}
                    className="flex-1 bg-transparent border-none outline-none px-2 py-1 text-sm font-bold text-slate-700 dark:text-slate-200"
                  />
                  <button onMouseDown={(e) => { e.preventDefault(); handleSaveEdit(); }} className="p-1.5 text-green-500 hover:bg-green-50 rounded-lg"><Check className="w-4 h-4" /></button>
                </div>
              ) : (
                <div 
                  onClick={handleStartEditing}
                  className="flex-1 flex items-center gap-2 cursor-pointer group/title min-w-0"
                >
                  <span className={`font-bold text-sm leading-tight transition-all flex-1 ${task.completed ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}>
                    {task.title}
                  </span>
                  {!task.completed && (
                    <Edit2 className="w-3.5 h-3.5 text-slate-300 group-hover/title:text-indigo-500 transition-colors shrink-0 md:opacity-0 md:group-hover:opacity-100" />
                  )}
                  {task.isImportant && !task.completed && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 animate-pulse shrink-0" />}
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {task.time && <span className="flex items-center gap-1 text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 dark:bg-slate-800 px-2 py-0.5 rounded-lg border dark:border-slate-700/50"><Clock className="w-3 h-3" /> {task.time}</span>}
              {task.reminderAt && <span className="flex items-center gap-1 text-[9px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-lg border border-indigo-100 dark:border-indigo-800/50"><Bell className="w-3 h-3" /> {task.reminderAt}</span>}
              <div className={`px-2 py-0.5 rounded-lg border text-[9px] font-black uppercase tracking-widest ${currentPriority.color}`}>
                {currentPriority.label}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => setIsConfirming(true)} className="text-slate-200 dark:text-slate-800 hover:text-red-500 p-2 transition-all">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Camera/Image Actions hidden in main view, available via icons or Gemini */}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {isConfirming && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={() => setIsConfirming(false)} />
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-xs rounded-[2.5rem] p-8 shadow-2xl border dark:border-slate-800 text-center animate-in zoom-in-95">
            <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trash2 className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-lg font-bold mb-2">Löschen?</h3>
            <p className="text-xs text-slate-400 mb-8 leading-relaxed">Möchtest du diese Aufgabe wirklich entfernen?</p>
            <div className="flex flex-col gap-2">
              <button onClick={() => { onDelete(task.id); setIsConfirming(false); }} className="w-full py-4 bg-red-500 text-white rounded-2xl font-bold shadow-lg shadow-red-200 active:scale-95 transition-all">Löschen</button>
              <button onClick={() => setIsConfirming(false)} className="w-full py-4 text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-all">Abbrechen</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TaskItem;
