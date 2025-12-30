
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
  ChevronDown,
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
          ? 'border-amber-200 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-900/10 shadow-lg' 
          : 'border-transparent shadow-sm hover:border-slate-100 dark:hover:border-slate-800 bg-white dark:bg-slate-900'
        }
        ${task.completed ? 'bg-slate-50 dark:bg-slate-950 opacity-50 border-transparent shadow-none scale-[0.98]' : ''}
      `}>
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <button onClick={() => onToggle(task.id)} className="text-slate-300 dark:text-slate-700 hover:text-green-500 transition-all active:scale-90 shrink-0">
              {task.completed ? <CheckCircle className="w-7 h-7 text-green-500" /> : <Circle className="w-7 h-7" />}
            </button>
            
            <div className="flex flex-col flex-1 min-w-0">
              {isEditing ? (
                <div className="space-y-2 pr-4">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none outline-none rounded-xl px-3 py-1.5 text-sm font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-indigo-500/20"
                    placeholder="Aufgabenname..."
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                  />
                  <div className="flex items-center gap-2">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <input
                      type="text"
                      value={editTime}
                      onChange={(e) => setEditTime(e.target.value)}
                      className="bg-slate-50 dark:bg-slate-800 border-none outline-none rounded-lg px-2 py-0.5 text-[10px] font-black uppercase tracking-widest text-slate-500 focus:ring-2 focus:ring-indigo-500/20"
                      placeholder="Zeit (z.B. 14:00)"
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    {/* Priority Dropdown Trigger */}
                    <div className="relative" ref={priorityMenuRef}>
                      <button 
                        onClick={() => !task.completed && setShowPriorityMenu(!showPriorityMenu)}
                        className={`
                          w-7 h-7 flex items-center justify-center rounded-lg border text-[10px] font-black shrink-0 transition-transform active:scale-95
                          ${currentPriority.color}
                          ${!task.completed ? 'cursor-pointer' : 'cursor-default'}
                        `}
                        title="Priorität ändern"
                      >
                        {currentPriority.symbol}
                      </button>
                      
                      {showPriorityMenu && (
                        <div className="absolute top-full left-0 mt-2 z-[100] w-32 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl shadow-2xl p-1.5 animate-in fade-in zoom-in-95 duration-200">
                          {(Object.keys(priorityConfig) as Array<'low' | 'medium' | 'high'>).map((prio) => (
                            <button
                              key={prio}
                              onClick={() => handlePriorityChange(prio)}
                              className={`
                                w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors
                                ${task.priority === prio 
                                  ? priorityConfig[prio].color 
                                  : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
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

                    <span className={`font-bold text-sm truncate ${task.completed ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}>
                      {task.title}
                    </span>
                    {task.isImportant && !task.completed && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 animate-pulse shrink-0" />}
                  </div>
                  
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {task.time && <span className="flex items-center gap-1 text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg"><Clock className="w-3 h-3" /> {task.time}</span>}
                    {task.reminderAt && <span className="flex items-center gap-1 text-[9px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-lg"><Bell className="w-3 h-3" /> {task.reminderAt}</span>}
                  </div>
                </>
              )}
            </div>

            {task.imageUrl && !isEditing && (
              <div className="relative w-14 h-14 rounded-2xl overflow-hidden border-2 border-white dark:border-slate-800 shadow-xl cursor-zoom-in shrink-0 group" onClick={() => setIsPreviewOpen(true)}>
                <img src={task.imageUrl} className="w-full h-full object-cover" alt="" />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Maximize2 className="w-4 h-4 text-white" />
                </div>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-1 ml-4 shrink-0">
            {isEditing ? (
              <>
                <button onClick={handleSaveEdit} className="p-2.5 rounded-xl text-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all" title="Speichern">
                  <Check className="w-4 h-4" />
                </button>
                <button onClick={handleCancelEdit} className="p-2.5 rounded-xl text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all" title="Abbrechen">
                  <X className="w-4 h-4" />
                </button>
              </>
            ) : (
              <>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                
                {!task.completed && (
                  <>
                    <button onClick={() => setIsEditing(true)} className="p-2.5 rounded-xl text-slate-200 dark:text-slate-800 hover:text-indigo-500 transition-all" title="Bearbeiten">
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button onClick={() => setIsCameraOpen(true)} className={`p-2.5 rounded-xl transition-all ${isCameraOpen ? 'bg-indigo-500 text-white' : 'text-slate-200 dark:text-slate-800 hover:text-indigo-500'}`} title="Foto machen">
                      <Camera className="w-4 h-4" />
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} className="p-2.5 rounded-xl text-slate-200 dark:text-slate-800 hover:text-indigo-500 transition-all" title="Bild hochladen">
                      <ImageIcon className="w-4 h-4" />
                    </button>
                    <button onClick={() => onToggleImportant?.(task.id)} className={`p-2.5 rounded-xl transition-all ${task.isImportant ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/30' : 'text-slate-200 dark:text-slate-800 hover:text-amber-400'}`}>
                      <Star className={`w-4 h-4 ${task.isImportant ? 'fill-current' : ''}`} />
                    </button>
                  </>
                )}

                <button onClick={() => setIsConfirming(true)} className="text-slate-200 dark:text-slate-800 hover:text-red-500 p-2.5 transition-all rounded-xl">
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
        </div>

        {isCameraOpen && (
          <div className="mt-4 animate-in slide-in-from-top-4 duration-300">
            <div className="relative aspect-video bg-slate-900 rounded-[1.8rem] overflow-hidden border-2 border-indigo-500/30 shadow-inner">
              <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
              <div className="absolute inset-0 flex flex-col justify-between p-4">
                <div className="flex justify-between items-start">
                  <div className="p-2 bg-black/40 backdrop-blur-md rounded-lg border border-white/10">
                    <Zap className="w-3 h-3 text-amber-400" />
                  </div>
                  <button onClick={() => setIsCameraOpen(false)} className="p-2 bg-black/40 backdrop-blur-md rounded-full text-white/60 hover:text-white border border-white/10 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex justify-center mb-2">
                   <button onClick={capturePhoto} className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-xl border-4 border-white flex items-center justify-center shadow-2xl active:scale-90 transition-all group">
                     <div className="w-10 h-10 rounded-full bg-white transition-transform group-hover:scale-95" />
                   </button>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-center mt-2 font-bold text-slate-400 uppercase tracking-widest">Kamera aktiv</p>
          </div>
        )}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {isPreviewOpen && (
        <div className="fixed inset-0 z-[250] bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
          <button onClick={() => setIsPreviewOpen(false)} className="absolute top-6 right-6 p-4 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors">
            <X className="w-8 h-8" />
          </button>
          <div className="max-w-4xl w-full max-h-[75vh] rounded-[3rem] overflow-hidden shadow-2xl border border-white/5 relative bg-slate-900">
            <img src={task.imageUrl} className="w-full h-full object-contain" alt="" />
          </div>
          <div className="mt-8 text-center space-y-4">
            <h2 className="text-white text-xl font-black">{task.title}</h2>
            <div className="flex gap-4">
               <button onClick={() => { onUpdate?.(task.id, { imageUrl: undefined }); setIsPreviewOpen(false); }} className="px-6 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-2xl text-xs font-bold transition-all flex items-center gap-2">
                <Trash2 className="w-4 h-4" /> Bild entfernen
              </button>
              <button onClick={() => setIsPreviewOpen(false)} className="px-8 py-3 bg-white text-slate-900 rounded-2xl text-xs font-bold shadow-xl active:scale-95 transition-all">Schließen</button>
            </div>
          </div>
        </div>
      )}

      {isConfirming && (
        <div className="fixed inset-0 z-[260] flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={() => setIsConfirming(false)} />
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-xs rounded-[2.5rem] p-8 shadow-2xl border dark:border-slate-800 text-center animate-in zoom-in-95">
            <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trash2 className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-lg font-bold mb-2">Aufgabe löschen?</h3>
            <p className="text-xs text-slate-400 mb-8 leading-relaxed">Möchtest du diese Aufgabe wirklich entfernen?</p>
            <div className="flex flex-col gap-2">
              <button onClick={() => { onDelete(task.id); setIsConfirming(false); }} className="w-full py-4 bg-red-500 text-white rounded-2xl font-bold active:scale-95 transition-all">Löschen</button>
              <button onClick={() => setIsConfirming(false)} className="w-full py-4 text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-all">Behalten</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TaskItem;
