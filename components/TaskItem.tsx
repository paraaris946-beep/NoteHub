
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
    high: { label: 'Hoch', symbol: '!', color: 'text-red-500 bg-red-50 dark:bg-red-900/30 border-red-100 dark:border-red-800/50' },
    medium: { label: 'Mittel', symbol: '?', color: 'text-amber-500 bg-amber-50 dark:bg-amber-900/30 border-amber-100 dark:border-amber-800/50' },
    low: { label: 'Niedrig', symbol: '.', color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/30 border-blue-100 dark:border-blue-800/50' }
  };

  const currentPriority = priorityConfig[task.priority];

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
        relative flex flex-col p-5 rounded-[2.5rem] transition-all border-2
        ${task.isImportant && !task.completed 
          ? 'border-amber-400/50 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-900/10 shadow-lg' 
          : 'border-transparent shadow-sm bg-white dark:bg-slate-900'
        }
        ${task.completed ? 'bg-slate-50 dark:bg-slate-950 opacity-60 border-transparent shadow-none scale-[0.98]' : ''}
      `}>
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            {/* Checkbox */}
            <button onClick={() => onToggle(task.id)} className="text-slate-300 dark:text-slate-700 hover:text-green-500 transition-all active:scale-90 shrink-0">
              {task.completed ? <CheckCircle className="w-9 h-9 text-green-500" /> : <Circle className="w-9 h-9" />}
            </button>
            
            {/* Content Area */}
            <div className="flex flex-col flex-1 min-w-0" onClick={() => !task.completed && !isEditing && setIsEditing(true)}>
              {isEditing ? (
                <div className="space-y-3 pr-2" onClick={(e) => e.stopPropagation()}>
                  <div className="relative">
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full bg-slate-100 dark:bg-slate-800 border-2 border-indigo-500 outline-none rounded-2xl px-4 py-3 text-base font-bold text-slate-800 dark:text-slate-100 shadow-inner"
                      placeholder="Was ist zu tun?"
                      autoFocus
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded-xl border border-transparent focus-within:border-indigo-500/30">
                      <Clock className="w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={editTime}
                        onChange={(e) => setEditTime(e.target.value)}
                        className="bg-transparent border-none outline-none text-xs font-black uppercase tracking-widest text-slate-600 dark:text-slate-300 w-20"
                        placeholder="HH:mm"
                        onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                      />
                    </div>
                    <div className="flex gap-2 ml-auto">
                       <button onClick={handleCancelEdit} className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-black uppercase">Abbrechen</button>
                       <button onClick={handleSaveEdit} className="px-4 py-2 rounded-xl bg-indigo-500 text-white text-[10px] font-black uppercase shadow-lg shadow-indigo-500/20">Speichern</button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="cursor-pointer group/title">
                  <div className="flex items-center gap-2">
                    {/* Priority Indicator */}
                    <div className="relative" ref={priorityMenuRef} onClick={(e) => e.stopPropagation()}>
                      <button 
                        onClick={() => !task.completed && setShowPriorityMenu(!showPriorityMenu)}
                        className={`
                          w-9 h-9 flex items-center justify-center rounded-2xl border-2 text-[12px] font-black shrink-0 transition-all active:scale-95 shadow-sm
                          ${currentPriority.color}
                          ${!task.completed ? 'cursor-pointer hover:brightness-95' : 'cursor-default'}
                        `}
                      >
                        {currentPriority.symbol}
                      </button>
                      
                      {showPriorityMenu && (
                        <div className="absolute top-full left-0 mt-3 z-[100] w-40 bg-white dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-800 rounded-[2rem] shadow-2xl p-2 animate-in fade-in zoom-in-95 duration-200">
                          {(Object.keys(priorityConfig) as Array<'low' | 'medium' | 'high'>).map((prio) => (
                            <button
                              key={prio}
                              onClick={() => handlePriorityChange(prio)}
                              className={`
                                w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-colors mb-1 last:mb-0
                                ${task.priority === prio 
                                  ? priorityConfig[prio].color 
                                  : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                }
                              `}
                            >
                              <span className="w-4 text-center">{priorityConfig[prio].symbol}</span>
                              {priorityConfig[prio].label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-bold text-base leading-tight truncate ${task.completed ? 'line-through text-slate-400' : 'text-slate-800 dark:text-slate-100'}`}>
                          {task.title}
                        </span>
                        {!task.completed && <Edit2 className="w-3.5 h-3.5 text-slate-300 dark:text-slate-700 opacity-0 group-hover/title:opacity-100 transition-opacity" />}
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {task.time && <span className="flex items-center gap-1 text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg border border-transparent"><Clock className="w-3 h-3" /> {task.time}</span>}
                        {task.reminderAt && <span className="flex items-center gap-1 text-[9px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-lg border border-indigo-200/20"><Bell className="w-3 h-3" /> {task.reminderAt}</span>}
                        {task.isImportant && !task.completed && <span className="flex items-center gap-1 text-[9px] font-black text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-lg"><Star className="w-3 h-3 fill-current" /> Wichtig</span>}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Photo Thumbnail */}
            {task.imageUrl && !isEditing && (
              <div className="relative w-14 h-14 rounded-2xl overflow-hidden border-2 border-white dark:border-slate-800 shadow-lg cursor-zoom-in shrink-0 ml-2" onClick={(e) => { e.stopPropagation(); setIsPreviewOpen(true); }}>
                <img src={task.imageUrl} className="w-full h-full object-cover" alt="" />
                <div className="absolute inset-0 bg-black/10 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                  <Maximize2 className="w-4 h-4 text-white" />
                </div>
              </div>
            )}
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center gap-1 ml-4 shrink-0">
            {!isEditing && (
              <div className="flex flex-wrap items-center justify-end gap-1 min-w-[100px]">
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                
                {!task.completed && (
                  <>
                    <button onClick={(e) => { e.stopPropagation(); setIsEditing(true); }} className="p-3 rounded-2xl text-slate-500 dark:text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 active:scale-90 transition-all" title="Bearbeiten">
                      <Edit2 className="w-4.5 h-4.5" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setIsCameraOpen(true); }} className={`p-3 rounded-2xl transition-all ${isCameraOpen ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-500 dark:text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'}`} title="Foto machen">
                      <Camera className="w-4.5 h-4.5" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); onToggleImportant?.(task.id); }} className={`p-3 rounded-2xl transition-all active:scale-90 ${task.isImportant ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' : 'text-slate-500 dark:text-slate-400 hover:text-amber-400'}`}>
                      <Star className={`w-4.5 h-4.5 ${task.isImportant ? 'fill-current' : ''}`} />
                    </button>
                  </>
                )}

                <button onClick={(e) => { e.stopPropagation(); setIsConfirming(true); }} className="text-slate-400 dark:text-slate-600 hover:text-red-500 p-3 active:bg-red-50 dark:active:bg-red-900/20 rounded-2xl transition-colors">
                  <Trash2 className="w-4.5 h-4.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Camera Inline View */}
        {isCameraOpen && (
          <div className="mt-5 animate-in slide-in-from-top-4 duration-300">
            <div className="relative aspect-video bg-slate-900 rounded-[2rem] overflow-hidden border-2 border-indigo-500/30 shadow-2xl">
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
              <div className="absolute inset-0 flex flex-col justify-between p-5">
                <div className="flex justify-between items-start">
                  <div className="px-3 py-1 bg-black/50 backdrop-blur-md rounded-full border border-white/10 flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[10px] text-white font-bold uppercase tracking-widest">Live</span>
                  </div>
                  <button onClick={() => setIsCameraOpen(false)} className="p-2.5 bg-black/50 backdrop-blur-md rounded-full text-white/80 hover:text-white border border-white/10 transition-colors">
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex justify-center mb-4">
                   <button onClick={capturePhoto} className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-xl border-4 border-white flex items-center justify-center shadow-2xl active:scale-90 transition-all group">
                     <div className="w-11 h-11 rounded-full bg-white transition-transform group-hover:scale-90" />
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
        <div className="fixed inset-0 z-[250] bg-slate-950/95 backdrop-blur-2xl flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
          <button onClick={() => setIsPreviewOpen(false)} className="absolute top-8 right-8 p-4 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors active:scale-90">
            <X className="w-8 h-8" />
          </button>
          <div className="max-w-4xl w-full max-h-[75vh] rounded-[3.5rem] overflow-hidden shadow-2xl border border-white/5 relative bg-slate-900">
            <img src={task.imageUrl} className="w-full h-full object-contain" alt="" />
          </div>
          <div className="mt-8 text-center space-y-6">
            <h2 className="text-white text-2xl font-black tracking-tight">{task.title}</h2>
            <div className="flex gap-4">
               <button onClick={() => { onUpdate?.(task.id, { imageUrl: undefined }); setIsPreviewOpen(false); }} className="px-6 py-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-2xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2">
                <Trash2 className="w-4 h-4" /> Bild entfernen
              </button>
              <button onClick={() => setIsPreviewOpen(false)} className="px-10 py-4 bg-white text-slate-900 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl active:scale-95 transition-all">Fertig</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isConfirming && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-md" onClick={() => setIsConfirming(false)} />
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-sm rounded-[3.5rem] p-10 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] border dark:border-slate-800 text-center animate-in zoom-in-95">
            <div className="w-24 h-24 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-8 shadow-inner">
              <Trash2 className="w-11 h-11 text-red-500" />
            </div>
            <h3 className="text-2xl font-black mb-3 dark:text-white tracking-tight">Aufgabe löschen?</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-10 leading-relaxed px-2">Soll die Aufgabe <strong>"{task.title}"</strong> wirklich entfernt werden?</p>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setIsConfirming(false)} className="py-5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-3xl font-black text-[11px] uppercase tracking-widest active:scale-95 transition-all">Abbrechen</button>
              <button onClick={() => { onDelete(task.id); setIsConfirming(false); }} className="py-5 bg-red-500 text-white rounded-3xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-red-500/30 active:scale-95 transition-all">Löschen</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TaskItem;
