
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
  Zap,
  Edit2,
  Check
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
  
  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(task.title);
  const [editTime, setEditTime] = useState(task.time || '');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const priorityMenuRef = useRef<HTMLDivElement>(null);

  const priorityConfig = {
    high: { label: 'Hoch', symbol: '!', color: 'text-red-500 bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800/50' },
    medium: { label: 'Mittel', symbol: '?', color: 'text-amber-500 bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800/50' },
    low: { label: 'Niedrig', symbol: '.', color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800/50' }
  };

  const currentPriority = priorityConfig[task.priority];

  // Auto-focus and select text when editing starts
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (priorityMenuRef.current && !priorityMenuRef.current.contains(event.target as Node)) {
        setShowPriorityMenu(false);
      }
    };
    if (showPriorityMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPriorityMenu]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    if (isCameraOpen) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
        .then(s => {
          stream = s;
          if (videoRef.current) videoRef.current.srcObject = s;
        })
        .catch(err => {
          console.error("Camera access denied", err);
          setIsCameraOpen(false);
        });
    }
    return () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
    };
  }, [isCameraOpen]);

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current && onUpdate) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        onUpdate(task.id, { imageUrl: dataUrl });
        setIsCameraOpen(false);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUpdate) {
      const reader = new FileReader();
      reader.onload = () => onUpdate(task.id, { imageUrl: reader.result as string });
      reader.readAsDataURL(file);
    }
  };

  const handlePriorityChange = (newPriority: 'low' | 'medium' | 'high') => {
    if (onUpdate) {
      onUpdate(task.id, { priority: newPriority });
    }
    setShowPriorityMenu(false);
  };

  const handleSaveEdit = () => {
    if (onUpdate) {
      onUpdate(task.id, { title: editTitle, time: editTime });
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditTitle(task.title);
    setEditTime(task.time || '');
    setIsEditing(false);
  };

  return (
    <>
      <div className={`
        relative flex flex-col p-5 rounded-[2.8rem] transition-all border-2
        ${task.isImportant && !task.completed 
          ? 'border-amber-400 dark:border-amber-500 bg-amber-50 dark:bg-amber-900/10 shadow-lg' 
          : 'border-transparent shadow-sm bg-white dark:bg-slate-900/60'
        }
        ${task.completed ? 'bg-slate-50 dark:bg-slate-950/40 opacity-60 border-transparent shadow-none scale-[0.98]' : ''}
        ${task.title === 'Neue Aufgabe' && !task.completed && !isEditing ? 'ring-2 ring-indigo-500/50 animate-pulse' : ''}
      `}>
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            {/* Checkbox */}
            <button onClick={(e) => { e.stopPropagation(); onToggle(task.id); }} className="text-slate-300 dark:text-slate-600 hover:text-green-500 transition-all active:scale-90 shrink-0">
              {task.completed ? <CheckCircle className="w-10 h-10 text-green-500" /> : <Circle className="w-10 h-10" />}
            </button>
            
            {/* Content Area - Bigger tap target for editing */}
            <div className="flex flex-col flex-1 min-w-0 py-1" onClick={() => !task.completed && !isEditing && setIsEditing(true)}>
              {isEditing ? (
                <div className="space-y-4 pr-2" onClick={(e) => e.stopPropagation()}>
                  <div className="relative">
                    <input
                      ref={inputRef}
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full bg-slate-100 dark:bg-slate-800 border-2 border-indigo-500 outline-none rounded-2xl px-4 py-4 text-lg font-bold text-slate-800 dark:text-slate-100 shadow-inner"
                      placeholder="Was ist zu tun?"
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-4 py-3 rounded-2xl border-2 border-transparent focus-within:border-indigo-500/30">
                      <Clock className="w-5 h-5 text-slate-400" />
                      <input
                        type="text"
                        value={editTime}
                        onChange={(e) => setEditTime(e.target.value)}
                        className="bg-transparent border-none outline-none text-xs font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 w-24"
                        placeholder="HH:mm"
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                      />
                    </div>
                    <div className="flex gap-2 ml-auto">
                       <button onClick={handleCancelEdit} className="px-5 py-3 rounded-2xl bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[11px] font-black uppercase tracking-widest active:scale-95 transition-all">Abbruch</button>
                       <button onClick={handleSaveEdit} className="px-5 py-3 rounded-2xl bg-indigo-500 text-white text-[11px] font-black uppercase tracking-widest shadow-xl shadow-indigo-500/30 active:scale-95 transition-all">OK</button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="cursor-pointer group/title select-none">
                  <div className="flex items-center gap-3">
                    {/* Priority Indicator */}
                    <div className="relative" ref={priorityMenuRef} onClick={(e) => e.stopPropagation()}>
                      <button 
                        onClick={() => !task.completed && setShowPriorityMenu(!showPriorityMenu)}
                        className={`
                          w-10 h-10 flex items-center justify-center rounded-2xl border-2 text-[14px] font-black shrink-0 transition-all active:scale-95 shadow-md
                          ${currentPriority.color}
                          ${!task.completed ? 'cursor-pointer hover:brightness-95' : 'cursor-default'}
                        `}
                      >
                        {currentPriority.symbol}
                      </button>
                      
                      {showPriorityMenu && (
                        <div className="absolute top-full left-0 mt-4 z-[100] w-48 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-[2.5rem] shadow-2xl p-3 animate-in fade-in zoom-in-95 duration-200">
                          {(Object.keys(priorityConfig) as Array<'low' | 'medium' | 'high'>).map((prio) => (
                            <button
                              key={prio}
                              onClick={() => handlePriorityChange(prio)}
                              className={`
                                w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-colors mb-2 last:mb-0
                                ${task.priority === prio 
                                  ? priorityConfig[prio].color 
                                  : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }
                              `}
                            >
                              <span className="w-5 text-center text-lg">{priorityConfig[prio].symbol}</span>
                              {priorityConfig[prio].label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold text-lg leading-tight truncate ${task.completed ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-100'}`}>
                          {task.title}
                        </span>
                        {!task.completed && <Edit2 className="w-4 h-4 text-indigo-400 opacity-60 group-hover/title:opacity-100 transition-opacity" />}
                      </div>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {task.time && <span className="flex items-center gap-1.5 text-[10px] font-black text-slate-500 dark:text-slate-300 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-xl"><Clock className="w-3.5 h-3.5" /> {task.time}</span>}
                        {task.reminderAt && <span className="flex items-center gap-1.5 text-[10px] font-black text-indigo-500 dark:text-indigo-300 uppercase tracking-widest bg-indigo-50 dark:bg-indigo-900/40 px-2.5 py-1 rounded-xl"><Bell className="w-3.5 h-3.5" /> {task.reminderAt}</span>}
                        {task.isImportant && !task.completed && <span className="flex items-center gap-1.5 text-[10px] font-black text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30 px-2.5 py-1 rounded-xl"><Star className="w-3.5 h-3.5 fill-current" /> Wichtig</span>}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Photo Thumbnail */}
            {task.imageUrl && !isEditing && (
              <div className="relative w-16 h-16 rounded-2xl overflow-hidden border-2 border-white dark:border-slate-800 shadow-xl cursor-zoom-in shrink-0 ml-2" onClick={(e) => { e.stopPropagation(); setIsPreviewOpen(true); }}>
                <img src={task.imageUrl} className="w-full h-full object-cover" alt="" />
                <div className="absolute inset-0 bg-black/10 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <Maximize2 className="w-5 h-5 text-white" />
                </div>
              </div>
            )}
          </div>
          
          {/* Action Buttons - HIGHER CONTRAST & SPACING */}
          <div className="flex items-center gap-2 ml-4 shrink-0">
            {!isEditing && (
              <div className="flex items-center justify-end gap-1.5">
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                
                {!task.completed && (
                  <>
                    <button onClick={(e) => { e.stopPropagation(); setIsCameraOpen(true); }} className={`p-3.5 rounded-2xl transition-all ${isCameraOpen ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-500 dark:text-slate-100 hover:text-indigo-500 bg-slate-100 dark:bg-slate-800'}`} title="Foto machen">
                      <Camera className="w-5 h-5" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onToggleImportant?.(task.id); }} className={`p-3.5 rounded-2xl transition-all active:scale-90 ${task.isImportant ? 'text-amber-500 bg-amber-100 dark:bg-amber-900/40' : 'text-slate-500 dark:text-slate-100 bg-slate-100 dark:bg-slate-800'}`}>
                      <Star className={`w-5 h-5 ${task.isImportant ? 'fill-current' : ''}`} />
                    </button>
                  </>
                )}

                <button onClick={(e) => { e.stopPropagation(); setIsConfirming(true); }} className="text-slate-400 dark:text-slate-400 hover:text-red-500 p-3.5 bg-slate-100 dark:bg-slate-800/50 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-2xl transition-all">
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Camera Inline View */}
        {isCameraOpen && (
          <div className="mt-6 animate-in slide-in-from-top-4 duration-300">
            <div className="relative aspect-video bg-slate-900 rounded-[2.5rem] overflow-hidden border-2 border-indigo-500/40 shadow-2xl">
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
              <div className="absolute inset-0 flex flex-col justify-between p-6">
                <div className="flex justify-between items-start">
                  <div className="px-4 py-1.5 bg-black/60 backdrop-blur-md rounded-full border border-white/20 flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[11px] text-white font-black uppercase tracking-widest">Live</span>
                  </div>
                  <button onClick={() => setIsCameraOpen(false)} className="p-3 bg-black/60 backdrop-blur-md rounded-full text-white hover:text-indigo-300 border border-white/20 transition-colors">
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <div className="flex justify-center mb-6">
                   <button onClick={capturePhoto} className="w-20 h-20 rounded-full bg-white/30 backdrop-blur-xl border-4 border-white flex items-center justify-center shadow-2xl active:scale-90 transition-all group">
                     <div className="w-14 h-14 rounded-full bg-white transition-transform group-hover:scale-90 shadow-inner" />
                   </button>
                </div>
              </div>
            </div>
          </div>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Fullscreen Preview */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-[250] bg-slate-950/98 backdrop-blur-3xl flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
          <button onClick={() => setIsPreviewOpen(false)} className="absolute top-10 right-10 p-5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all active:scale-90 border border-white/10">
            <X className="w-9 h-9" />
          </button>
          <div className="max-w-5xl w-full max-h-[80vh] rounded-[4rem] overflow-hidden shadow-2xl border border-white/10 relative bg-slate-900">
            <img src={task.imageUrl} className="w-full h-full object-contain" alt="" />
          </div>
          <div className="mt-10 text-center space-y-8">
            <h2 className="text-white text-3xl font-black tracking-tight">{task.title}</h2>
            <div className="flex gap-4">
               <button onClick={() => { onUpdate?.(task.id, { imageUrl: undefined }); setIsPreviewOpen(false); }} className="px-8 py-5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-3xl text-[12px] font-black uppercase tracking-widest transition-all border border-red-500/20 flex items-center gap-3">
                <Trash2 className="w-5 h-5" /> Bild löschen
              </button>
              <button onClick={() => setIsPreviewOpen(false)} className="px-12 py-5 bg-white text-slate-900 rounded-3xl text-[12px] font-black uppercase tracking-widest shadow-2xl active:scale-95 transition-all">Schließen</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isConfirming && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl" onClick={() => setIsConfirming(false)} />
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-sm rounded-[4rem] p-12 shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)] border dark:border-slate-800 text-center animate-in zoom-in-95">
            <div className="w-28 h-28 bg-red-50 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-10 shadow-inner">
              <Trash2 className="w-12 h-12 text-red-500" />
            </div>
            <h3 className="text-3xl font-black mb-4 dark:text-white tracking-tight">Aufgabe löschen?</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-12 leading-relaxed px-2">Soll die Aufgabe <strong>"{task.title}"</strong> wirklich entfernt werden?</p>
            <div className="grid grid-cols-2 gap-5">
              <button onClick={() => setIsConfirming(false)} className="py-6 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200 rounded-[2rem] font-black text-[12px] uppercase tracking-widest active:scale-95 transition-all">Behalten</button>
              <button onClick={() => { onDelete(task.id); setIsConfirming(false); }} className="py-6 bg-red-500 text-white rounded-[2rem] font-black text-[12px] uppercase tracking-widest shadow-2xl shadow-red-500/40 active:scale-95 transition-all">Löschen</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TaskItem;
