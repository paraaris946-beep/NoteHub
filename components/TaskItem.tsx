
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
  BellOff,
  ChevronDown,
  AlertTriangle,
  HelpCircle,
  MoreHorizontal,
  RefreshCw,
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
  const [showReminderPicker, setShowReminderPicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const priorityConfig = {
    high: { symbol: '!', color: 'text-red-500 bg-red-50 dark:bg-red-900/30 border-red-100 dark:border-red-800/50', next: 'medium' as const },
    medium: { symbol: '?', color: 'text-amber-500 bg-amber-50 dark:bg-amber-900/30 border-amber-100 dark:border-amber-800/50', next: 'low' as const },
    low: { symbol: '.', color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/30 border-blue-100 dark:border-blue-800/50', next: 'high' as const }
  };

  const currentPriority = priorityConfig[task.priority];

  // Camera Logic
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

  const togglePriority = () => {
    if (onUpdate && !task.completed) onUpdate(task.id, { priority: currentPriority.next });
  };

  return (
    <>
      <div className={`
        relative flex flex-col p-5 rounded-[2.5rem] transition-all border-2 overflow-hidden
        ${task.isImportant && !task.completed 
          ? 'border-amber-200 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-900/10 shadow-lg' 
          : 'border-transparent shadow-sm hover:shadow-md hover:border-slate-100 dark:hover:border-slate-800 bg-white dark:bg-slate-900'
        }
        ${task.completed ? 'bg-slate-50 dark:bg-slate-950 opacity-50 border-transparent shadow-none scale-[0.98]' : ''}
      `}>
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <button onClick={() => onToggle(task.id)} className="text-slate-300 dark:text-slate-700 hover:text-green-500 transition-all active:scale-90 shrink-0">
              {task.completed ? <CheckCircle className="w-7 h-7 text-green-500" /> : <Circle className="w-7 h-7" />}
            </button>
            
            <div className="flex flex-col flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <button onClick={togglePriority} disabled={task.completed} className={`w-6 h-6 flex items-center justify-center rounded-lg border text-[10px] font-black transition-all shrink-0 ${currentPriority.color} ${!task.completed ? 'hover:scale-110 active:scale-95 shadow-sm' : 'opacity-30'}`}>
                  {currentPriority.symbol}
                </button>
                <span className={`font-bold text-sm truncate transition-all ${task.completed ? 'line-through text-slate-400' : 'text-slate-700 dark:text-slate-200'}`}>
                  {task.title}
                </span>
                {task.isImportant && !task.completed && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 animate-pulse shrink-0" />}
              </div>
              
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {task.time && <span className="flex items-center gap-1 text-[9px] font-black text-slate-400 uppercase tracking-widest bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-lg"><Clock className="w-3 h-3" /> {task.time}</span>}
                {task.reminderAt && <span className="flex items-center gap-1 text-[9px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-lg"><Bell className="w-3 h-3" /> {task.reminderAt}</span>}
                {task.imageUrl && (
                  <button onClick={() => setIsPreviewOpen(true)} className="flex items-center gap-1 text-[9px] font-black text-emerald-500 dark:text-emerald-400 uppercase tracking-widest bg-emerald-50 dark:bg-emerald-900/30 px-2 py-0.5 rounded-lg hover:scale-105 transition-transform">
                    <ImageIcon className="w-3 h-3" /> Anhang
                  </button>
                )}
              </div>
            </div>

            {task.imageUrl && !task.completed && (
              <div className="relative w-14 h-14 rounded-2xl overflow-hidden border-2 border-white dark:border-slate-800 shadow-xl cursor-zoom-in shrink-0 group" onClick={() => setIsPreviewOpen(true)}>
                <img src={task.imageUrl} className="w-full h-full object-cover transition-transform group-hover:scale-110" alt="" />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <Maximize2 className="w-4 h-4 text-white" />
                </div>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-1 ml-4 shrink-0">
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
            
            {!task.completed && (
              <>
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
          </div>
        </div>

        {/* Camera Searcher - Integrated UI */}
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

      {/* Preview Modal (Lightbox) */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-[250] bg-slate-950/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 animate-in fade-in duration-300">
          <button onClick={() => setIsPreviewOpen(false)} className="absolute top-6 right-6 p-4 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors">
            <X className="w-8 h-8" />
          </button>
          
          <div className="max-w-4xl w-full max-h-[75vh] rounded-[3rem] overflow-hidden shadow-2xl border border-white/5 relative bg-slate-900">
            <img src={task.imageUrl} className="w-full h-full object-contain" alt={task.title} />
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

      {/* Delete Confirm */}
      {isConfirming && (
        <div className="fixed inset-0 z-[260] flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={() => setIsConfirming(false)} />
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-xs rounded-[2.5rem] p-8 shadow-2xl border dark:border-slate-800 text-center animate-in zoom-in-95">
            <div className="w-16 h-16 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
              <Trash2 className="w-8 h-8 text-red-500" />
            </div>
            <h3 className="text-lg font-bold mb-2">Aufgabe löschen?</h3>
            <p className="text-xs text-slate-400 mb-8 leading-relaxed">Möchtest du "{task.title}" wirklich dauerhaft entfernen?</p>
            <div className="flex flex-col gap-2">
              <button onClick={() => { onDelete(task.id); setIsConfirming(false); }} className="w-full py-4 bg-red-500 text-white rounded-2xl font-bold shadow-lg shadow-red-200 dark:shadow-none active:scale-95 transition-all">Löschen</button>
              <button onClick={() => setIsConfirming(false)} className="w-full py-4 text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl transition-all">Behalten</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TaskItem;
