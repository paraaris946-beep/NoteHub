
import React, { useState, useRef } from 'react';
import { Task } from '../types';
import { 
  CheckCircle, 
  Circle, 
  Clock, 
  Trash2, 
  X, 
  Star, 
  AlertCircle, 
  Camera, 
  Image as ImageIcon, 
  Maximize2,
  Bell,
  BellOff
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
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const priorityColor = {
    high: 'text-red-500 bg-red-50 dark:bg-red-900/20 dark:text-red-400',
    medium: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400',
    low: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400'
  }[task.priority];

  const containerClasses = `
    relative flex flex-col p-5 rounded-[2rem] transition-all border-2 overflow-hidden
    ${task.isImportant && !task.completed 
      ? 'border-amber-200 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-900/10 shadow-lg shadow-amber-100/50 dark:shadow-none' 
      : 'border-transparent shadow-sm hover:shadow-md hover:border-slate-100 dark:hover:border-slate-800 bg-white dark:bg-slate-900'
    }
    ${task.completed ? 'bg-slate-50 dark:bg-slate-950 opacity-50 border-transparent shadow-none scale-[0.98]' : ''}
  `;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUpdate) {
      const reader = new FileReader();
      reader.onload = () => {
        onUpdate(task.id, { imageUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleReminderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onUpdate) {
      onUpdate(task.id, { reminderAt: e.target.value });
    }
  };

  const handlePlannedTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (onUpdate) {
      onUpdate(task.id, { time: e.target.value });
    }
  };

  const removeReminder = () => {
    if (onUpdate) {
      onUpdate(task.id, { reminderAt: undefined });
      setShowReminderPicker(false);
    }
  };

  const removePlannedTime = () => {
    if (onUpdate) {
      onUpdate(task.id, { time: undefined });
      setShowTimePicker(false);
    }
  };

  return (
    <>
      <div className={containerClasses}>
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <button 
              onClick={() => onToggle(task.id)}
              className="text-slate-300 dark:text-slate-700 hover:text-green-500 transition-all active:scale-90 shrink-0"
            >
              {task.completed ? <CheckCircle className="w-7 h-7 text-green-500" /> : <Circle className="w-7 h-7" />}
            </button>
            
            <div className="flex flex-col flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={`font-bold text-sm truncate transition-all ${task.completed ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}>
                  {task.title}
                </span>
                {task.isImportant && !task.completed && (
                  <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 animate-pulse shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                {task.time && (
                  <span className="flex items-center gap-1 text-[9px] font-bold text-slate-400 uppercase tracking-tighter bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg">
                    <Clock className="w-3 h-3" /> {task.time}
                  </span>
                )}
                {task.reminderAt && (
                  <span className="flex items-center gap-1 text-[9px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-tighter bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-lg">
                    <Bell className="w-3 h-3" /> {task.reminderAt}
                  </span>
                )}
                <span className={`text-[8px] uppercase font-black px-2 py-0.5 rounded-lg ${priorityColor}`}>
                  {task.priority}
                </span>
                {task.imageUrl && (
                  <button 
                    onClick={() => setIsPreviewOpen(true)}
                    className="flex items-center gap-1 text-[9px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-tighter bg-indigo-50 dark:bg-indigo-900/20 px-2 py-0.5 rounded-lg hover:bg-indigo-100 transition-colors"
                  >
                    <ImageIcon className="w-3 h-3" /> Bild
                  </button>
                )}
              </div>
            </div>

            {task.imageUrl && !task.completed && (
              <div 
                className="relative w-12 h-12 rounded-xl overflow-hidden border-2 border-white dark:border-slate-800 shadow-sm cursor-zoom-in shrink-0 group"
                onClick={() => setIsPreviewOpen(true)}
              >
                <img src={task.imageUrl} className="w-full h-full object-cover transition-transform group-hover:scale-110" alt="" />
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-1 ml-4">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept="image/*" 
              className="hidden" 
            />
            
            {!task.completed && (
              <>
                <button 
                  onClick={() => { setShowTimePicker(!showTimePicker); setShowReminderPicker(false); }}
                  className={`p-2 rounded-xl transition-all ${task.time || showTimePicker ? 'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-300' : 'text-slate-200 dark:text-slate-800 hover:text-slate-400'}`}
                  title="Uhrzeit festlegen"
                >
                  <Clock className="w-4 h-4" />
                </button>

                <button 
                  onClick={() => { setShowReminderPicker(!showReminderPicker); setShowTimePicker(false); }}
                  className={`p-2 rounded-xl transition-all ${task.reminderAt || showReminderPicker ? 'text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30' : 'text-slate-200 dark:text-slate-800 hover:text-indigo-400'}`}
                  title="Erinnerung einstellen"
                >
                  <Bell className="w-4 h-4" />
                </button>

                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className={`p-2 rounded-xl transition-all ${task.imageUrl ? 'text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30' : 'text-slate-200 dark:text-slate-800 hover:text-indigo-400'}`}
                  title="Foto hinzufügen"
                >
                  <Camera className="w-4 h-4" />
                </button>
                
                <button 
                  onClick={() => onToggleImportant?.(task.id)}
                  className={`p-2 rounded-xl transition-all ${task.isImportant ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/30' : 'text-slate-200 dark:text-slate-800 hover:text-amber-400'}`}
                >
                  <Star className={`w-4 h-4 ${task.isImportant ? 'fill-current' : ''}`} />
                </button>
              </>
            )}

            <button 
              onClick={() => setIsConfirming(true)}
              className="text-slate-200 dark:text-slate-800 hover:text-red-500 p-2 transition-all rounded-xl"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Zeit-Picker für Geplante Zeit (task.time) */}
        {showTimePicker && !task.completed && (
          <div className="mt-4 flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl animate-in slide-in-from-top-2 duration-200 border border-slate-100 dark:border-slate-800">
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest px-1">Geplante Zeit</label>
              <input 
                type="text" 
                value={task.time || ""} 
                onChange={handlePlannedTimeChange}
                placeholder="z.B. 14:00 oder Vormittag"
                className="bg-white dark:bg-slate-900 text-xs font-bold p-2 rounded-xl border border-slate-100 dark:border-slate-800 outline-none focus:border-slate-500/30 transition-all dark:text-white"
              />
            </div>
            <div className="flex gap-1 items-end">
              <button 
                onClick={removePlannedTime}
                className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                title="Zeit entfernen"
              >
                <Clock className="w-4 h-4 opacity-50" />
              </button>
              <button 
                onClick={() => setShowTimePicker(false)}
                className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
                title="Schließen"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Zeit-Picker für Erinnerung (task.reminderAt) */}
        {showReminderPicker && !task.completed && (
          <div className="mt-4 flex items-center gap-3 p-3 bg-indigo-50/30 dark:bg-indigo-900/10 rounded-2xl animate-in slide-in-from-top-2 duration-200 border border-indigo-100/50 dark:border-indigo-800/50">
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-[8px] font-black text-indigo-400 uppercase tracking-widest px-1">Erinnerungszeit</label>
              <input 
                type="time" 
                value={task.reminderAt || ""} 
                onChange={handleReminderChange}
                className="bg-white dark:bg-slate-900 text-xs font-bold p-2 rounded-xl border border-indigo-100/30 dark:border-indigo-800 outline-none focus:border-indigo-500/30 transition-all dark:text-white"
              />
            </div>
            <div className="flex gap-1 items-end">
              <button 
                onClick={removeReminder}
                className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                title="Erinnerung entfernen"
              >
                <BellOff className="w-4 h-4" />
              </button>
              <button 
                onClick={() => setShowReminderPicker(false)}
                className="p-2 text-slate-400 hover:text-indigo-500 transition-colors"
                title="Schließen"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bestätigungsdialog (Modal) */}
      {isConfirming && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={() => setIsConfirming(false)} />
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-xs rounded-[2.5rem] p-8 shadow-2xl border dark:border-slate-800 animate-in zoom-in-95 duration-200">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mb-6">
                <Trash2 className="w-8 h-8 text-red-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-2">Aufgabe löschen?</h3>
              <p className="text-xs text-slate-400 dark:text-slate-500 mb-8 leading-relaxed px-4">
                Möchtest du "{task.title}" wirklich dauerhaft entfernen? Dies kann nicht rückgängig gemacht werden.
              </p>
              <div className="flex flex-col w-full gap-2">
                <button 
                  onClick={() => { onDelete(task.id); setIsConfirming(false); }}
                  className="w-full py-4 bg-red-500 text-white rounded-2xl font-bold shadow-lg shadow-red-200 dark:shadow-none hover:bg-red-600 transition-all active:scale-95"
                >
                  Endgültig löschen
                </button>
                <button 
                  onClick={() => setIsConfirming(false)}
                  className="w-full py-4 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-colors"
                >
                  Behalten
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox / Preview Modal */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-[120] bg-slate-950/90 backdrop-blur-lg flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
          <button 
            onClick={() => setIsPreviewOpen(false)}
            className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors"
          >
            <X className="w-8 h-8" />
          </button>
          
          <div className="max-w-4xl w-full max-h-[70vh] rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/10 relative group">
            <img src={task.imageUrl} className="w-full h-full object-contain bg-slate-900" alt={task.title} />
          </div>
          
          <div className="mt-8 text-center">
            <h2 className="text-white text-xl font-bold">{task.title}</h2>
            <button 
              onClick={() => { onUpdate?.(task.id, { imageUrl: undefined }); setIsPreviewOpen(false); }}
              className="mt-6 px-6 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 mx-auto"
            >
              <Trash2 className="w-4 h-4" /> Bild entfernen
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default TaskItem;
