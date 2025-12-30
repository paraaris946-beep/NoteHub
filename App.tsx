
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Task, DayPlan, UserStats, Message, UserProfile } from './types';
import { 
  getGeminiClient,
  startCoachingChat, 
  generateFocusImage, 
  generateBriefingAudio, 
  generateMessageAudio,
  generateAppLogo,
  decodeBase64, 
  decodeAudioData 
} from './services/geminiService';
import { playNotificationSound } from './services/audioService';
import TaskItem from './components/TaskItem';
import VoiceAssistant from './components/VoiceAssistant';
import MoodTracker from './components/MoodTracker';
import { 
  Settings, 
  LayoutDashboard,
  Send,
  ChevronDown,
  Coffee,
  Volume2,
  Loader2,
  X,
  Moon,
  Sun,
  Plus,
  User,
  Brain,
  Bell,
  Check,
  Play,
  MessageSquare,
  Mic,
  Headphones,
  Trash2,
  Sparkles,
  Volume1,
  Download,
  Pause,
  Square,
  ChevronRight,
  UserCircle,
  FileText,
  ListTodo
} from 'lucide-react';

const INITIAL_MESSAGE: Message = { 
  id: '1', 
  role: 'model', 
  text: 'Moin. Ich bin NoteHub. Was steht heute bei dir an? Lass uns schauen, dass es ein entspannter Tag wird.', 
  timestamp: new Date() 
};

const VOICES = [
  { id: 'Kore', name: 'Kore', label: 'Männlich' },
  { id: 'Puck', name: 'Puck', label: 'Weiblich' },
  { id: 'Zephyr', name: 'Zephyr', label: 'Neutral' },
  { id: 'Charon', name: 'Charon', label: 'Tief' },
  { id: 'Fenrir', name: 'Fenrir', label: 'Rauh' },
];

const ThoughtVisualizer: React.FC<{ active: boolean; profile: UserProfile }> = ({ active, profile }) => {
  if (!active) return null;
  return (
    <div className="absolute bottom-24 left-6 right-6 z-30 animate-in fade-in slide-in-from-bottom-2 duration-300 md:bottom-20">
      <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-indigo-500/30 rounded-2xl py-2 px-4 shadow-xl flex items-center gap-3">
        <div className="flex gap-1">
          {[1, 2, 3].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: `${i * 0.1}s` }} />)}
        </div>
        <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">NoteHub denkt nach...</span>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem('minicoach_messages');
    return saved ? JSON.parse(saved).map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })) : [INITIAL_MESSAGE];
  });
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('minicoach_tasks');
    return saved ? JSON.parse(saved) : [];
  });
  const [dayPlan, setDayPlan] = useState<DayPlan | null>(() => {
    const saved = localStorage.getItem('minicoach_dayplan');
    return saved ? JSON.parse(saved) : null;
  });
  const [userStats, setUserStats] = useState<UserStats>(() => {
    const saved = localStorage.getItem('notehub_stats');
    return saved ? JSON.parse(saved) : { completedTasks: 0, totalTasks: 0, mood: '', waterIntake: 0 };
  });
  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('notehub_profile');
    return saved ? JSON.parse(saved) : { name: '', birthDate: '' };
  });

  const [userInput, setUserInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isBriefingLoading, setIsBriefingLoading] = useState(false);
  const [isLogoLoading, setIsLogoLoading] = useState(false);
  const [appLogoUrl, setAppLogoUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'plan' | 'chat'>('plan');
  const [isPanelOpen, setIsPanelOpen] = useState<'none' | 'settings' | 'voice'>('none');
  const [isListening, setIsListening] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState(() => localStorage.getItem('minicoach_voice') || 'Kore');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('minicoach_theme');
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });
  const [isPreviewingVoice, setIsPreviewingVoice] = useState<string | null>(null);
  const [showVoicePicker, setShowVoicePicker] = useState(false);
  
  // Audio Playback State
  const [playbackState, setPlaybackState] = useState<'idle' | 'playing' | 'paused'>('idle');
  const [playbackLabel, setPlaybackLabel] = useState<string>('');
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const playbackSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const [activeNotification, setActiveNotification] = useState<Task | null>(null);
  const triggeredRemindersRef = useRef<Set<string>>(new Set());
  const tasksRef = useRef<Task[]>(tasks);
  const voicePickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { tasksRef.current = tasks; }, [tasks]);

  const chatRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => { localStorage.setItem('minicoach_tasks', JSON.stringify(tasks)); }, [tasks]);
  useEffect(() => { localStorage.setItem('minicoach_dayplan', JSON.stringify(dayPlan)); }, [dayPlan]);
  useEffect(() => { localStorage.setItem('minicoach_messages', JSON.stringify(messages)); }, [messages]);
  useEffect(() => { localStorage.setItem('minicoach_voice', selectedVoice); }, [selectedVoice]);
  useEffect(() => { localStorage.setItem('notehub_profile', JSON.stringify(userProfile)); }, [userProfile]);
  useEffect(() => { localStorage.setItem('notehub_stats', JSON.stringify(userStats)); }, [userStats]);

  useEffect(() => {
    chatRef.current = startCoachingChat();
    const cachedLogo = localStorage.getItem('minicoach_logo');
    if (cachedLogo) setAppLogoUrl(cachedLogo);
    else handleRegenerateLogo();

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false; // Fix: Only process final results to prevent duplication
      recognitionRef.current.maxAlternatives = 1;
      recognitionRef.current.lang = 'de-DE';
      
      recognitionRef.current.onstart = () => {
        setIsListening(true);
        handleStopPlayback(); // Stop any reading when mic starts
      };
      
      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
      
      recognitionRef.current.onresult = (e: any) => {
        const transcript = e.results[0][0].transcript;
        if (transcript) {
          setUserInput(prev => (prev.trim() ? prev.trim() + ' ' : '') + transcript);
        }
      };

      recognitionRef.current.onerror = (e: any) => {
        console.error("Speech Recognition Error:", e.error);
        setIsListening(false);
      };
    }

    const interval = setInterval(() => {
      const now = new Date();
      const currentH = now.getHours().toString().padStart(2, '0');
      const currentM = now.getMinutes().toString().padStart(2, '0');
      const timeStr = `${currentH}:${currentM}`;

      tasksRef.current.forEach(task => {
        if (task.reminderAt === timeStr && !task.completed) {
          const reminderKey = `${task.id}-${timeStr}`;
          if (!triggeredRemindersRef.current.has(reminderKey)) {
            triggeredRemindersRef.current.add(reminderKey);
            triggerReminder(task);
          }
        }
      });
    }, 10000);

    const handleClickOutside = (event: MouseEvent) => {
      if (voicePickerRef.current && !voicePickerRef.current.contains(event.target as Node)) {
        setShowVoicePicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      clearInterval(interval);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const triggerReminder = (task: Task) => {
    playNotificationSound('Chime');
    setActiveNotification(task);
  };

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('minicoach_theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const handleRegenerateLogo = async () => {
    setIsLogoLoading(true);
    try {
      const logo = await generateAppLogo();
      setAppLogoUrl(logo);
      localStorage.setItem('minicoach_logo', logo);
    } catch (err) {
      console.error("Logo regeneration failed", err);
    } finally {
      setIsLogoLoading(false);
    }
  };

  const handleClearChat = () => {
    if (window.confirm('Möchtest du wirklich den gesamten Chatverlauf löschen?')) {
      setMessages([INITIAL_MESSAGE]);
      setIsPanelOpen('none');
    }
  };

  const handleExportCSV = () => {
    if (tasks.length === 0) {
      alert("Es gibt keine Aufgaben zum Exportieren.");
      return;
    }
    const headers = ['ID', 'Titel', 'Zeit', 'Erledigt', 'Prioritaet', 'Kategorie', 'Erinnerung', 'Wichtig'];
    const rows = tasks.map(t => [t.id, t.title.replace(/"/g, '""'), t.time || '', t.completed ? 'Ja' : 'Nein', t.priority, t.category, t.reminderAt || '', t.isImportant ? 'Ja' : 'Nein']);
    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `NoteHub_Plan_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportTXT = () => {
    if (tasks.length === 0) {
      alert("Es gibt keine Aufgaben zum Exportieren.");
      return;
    }
    const dateStr = new Date().toLocaleDateString('de-DE');
    let txtContent = `NoteHub - Aufgabenliste vom ${dateStr}\n`;
    txtContent += "=".repeat(txtContent.length) + "\n\n";

    const openTasks = tasks.filter(t => !t.completed);
    const completedTasks = tasks.filter(t => t.completed);

    if (openTasks.length > 0) {
      txtContent += "OFFENE AUFGABEN:\n";
      openTasks.forEach(t => {
        const priority = t.priority === 'high' ? '!!!' : t.priority === 'medium' ? '??' : '.';
        txtContent += `- [ ] ${t.title} (Prio: ${priority}${t.time ? `, Zeit: ${t.time}` : ''}${t.isImportant ? ', WICHTIG' : ''})\n`;
      });
      txtContent += "\n";
    }

    if (completedTasks.length > 0) {
      txtContent += "ERLEDIGTE AUFGABEN:\n";
      completedTasks.forEach(t => {
        txtContent += `- [x] ${t.title}\n`;
      });
    }

    const blob = new Blob([txtContent], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `NoteHub_Aufgaben_${new Date().toISOString().split('T')[0]}.txt`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const playAudio = async (audioBase64: string, label: string) => {
    // Stop any active microphone before speaking to prevent feedback loops
    if (isListening) recognitionRef.current?.stop();
    
    handleStopPlayback();
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    playbackCtxRef.current = ctx;
    try {
      const buf = await decodeAudioData(decodeBase64(audioBase64), ctx, 24000, 1);
      const source = ctx.createBufferSource();
      source.buffer = buf;
      source.connect(ctx.destination);
      playbackSourceRef.current = source;
      source.onended = () => { setPlaybackState('idle'); setPlaybackLabel(''); };
      setPlaybackLabel(label);
      setPlaybackState('playing');
      source.start();
    } catch (err) { console.error("Playback error", err); setPlaybackState('idle'); }
  };

  const handleTogglePlayback = async () => {
    if (!playbackCtxRef.current) return;
    if (playbackState === 'playing') { await playbackCtxRef.current.suspend(); setPlaybackState('paused'); }
    else if (playbackState === 'paused') { await playbackCtxRef.current.resume(); setPlaybackState('playing'); }
  };

  const handleStopPlayback = () => {
    if (playbackSourceRef.current) { try { playbackSourceRef.current.stop(); } catch (e) {} playbackSourceRef.current = null; }
    if (playbackCtxRef.current) { playbackCtxRef.current.close(); playbackCtxRef.current = null; }
    setPlaybackState('idle'); setPlaybackLabel('');
  };

  const handlePlayBriefing = async () => {
    if (isBriefingLoading) return;
    setIsBriefingLoading(true);
    try {
      const audio = await generateBriefingAudio(tasks, dayPlan?.focus, dayPlan?.motivation, selectedVoice);
      await playAudio(audio, 'Tages-Briefing');
    } catch (err) { console.error("Briefing failed", err); }
    finally { setIsBriefingLoading(false); }
  };

  const handlePlayMessage = async (text: string) => {
    try {
      const audio = await generateMessageAudio(text, selectedVoice);
      await playAudio(audio, 'Nachricht vorlesen');
    } catch (err) { console.error("Message audio failed", err); }
  };

  const handlePreviewVoice = async (voiceId: string) => {
    if (isPreviewingVoice) return;
    setIsPreviewingVoice(voiceId);
    try {
      const text = `Hallo, ich bin die Stimme ${voiceId}.`;
      const audio = await generateMessageAudio(text, voiceId);
      await playAudio(audio, `Vorschau: ${voiceId}`);
    } catch (err) { console.error("Voice preview failed", err); }
    finally { setIsPreviewingVoice(null); }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!userInput.trim() && !selectedImage) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: userInput, timestamp: new Date(), image: selectedImage || undefined };
    setMessages(prev => [...prev, userMsg]);
    setUserInput('');
    setSelectedImage(null);
    setIsLoading(true);

    try {
      const response = await chatRef.current.sendMessage({ message: userMsg.text });
      const modelText = response.text;
      let cleanText = modelText;
      if (modelText.includes('[PLAN_JSON]')) {
        const parts = modelText.split('[PLAN_JSON]');
        cleanText = parts[0].trim();
        try {
          const planData = JSON.parse(parts[1].trim());
          setDayPlan(planData);
          setTasks(planData.tasks);
          // On mobile, switch to plan tab if tasks are updated
          if (window.innerWidth < 768) setActiveTab('plan');
        } catch (err) { console.error("JSON parse failed", err); }
      }
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'model', text: cleanText, timestamp: new Date() }]);
    } catch (err) { console.error("Chat message failed", err); }
    finally { setIsLoading(false); }
  };

  const toggleMic = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      recognitionRef.current?.start();
    }
  };

  const openTasksCount = tasks.filter(t => !t.completed).length;

  return (
    <div className={`h-screen flex flex-col overflow-hidden ${isDarkMode ? 'dark bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* Audio Playback Controls Overlay - DOCKED ABOVE BOTTOM NAV ON MOBILE */}
      {playbackState !== 'idle' && (
        <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-sm animate-in slide-in-from-bottom-4 fade-in duration-500 md:bottom-6`}>
          <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-indigo-500/30 p-3 rounded-[2rem] shadow-2xl flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center shrink-0">
               <Volume2 className={`w-5 h-5 text-white ${playbackState === 'playing' ? 'animate-pulse' : ''}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[9px] font-black text-indigo-500 uppercase tracking-widest truncate">{playbackLabel}</p>
              <p className="text-[10px] font-bold dark:text-slate-300 truncate">{playbackState === 'playing' ? 'Wird abgespielt' : 'Pausiert'}</p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={handleTogglePlayback} className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-full">
                {playbackState === 'playing' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 text-indigo-500" />}
              </button>
              <button onClick={handleStopPlayback} className="p-2.5 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-red-500 hover:text-white transition-colors">
                <Square className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Persistent Smart Panel (Sidebar / Drawer) */}
      <div className={`
        fixed inset-y-0 right-0 z-[200] w-full max-w-md transition-transform duration-500 ease-out
        ${isPanelOpen !== 'none' ? 'translate-x-0' : 'translate-x-full'}
      `}>
        <div className={`absolute inset-0 bg-slate-950/20 backdrop-blur-sm transition-opacity duration-500 ${isPanelOpen !== 'none' ? 'opacity-100' : 'opacity-0'}`} onClick={() => setIsPanelOpen('none')} />
        
        <div className="relative h-full bg-white dark:bg-slate-900 border-l dark:border-slate-800 shadow-2xl flex flex-col p-8 overflow-y-auto custom-scrollbar">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold dark:text-white">
              {isPanelOpen === 'settings' ? 'Einstellungen' : 'NoteHub Voice'}
            </h2>
            <button onClick={() => setIsPanelOpen('none')} className="p-2 bg-slate-50 dark:bg-slate-800 rounded-full">
              <X className="w-5 h-5 text-slate-400" />
            </button>
          </div>

          {isPanelOpen === 'voice' && (
            <div className="flex-1 flex flex-col justify-center gap-8">
               <div className="bg-indigo-50/30 dark:bg-indigo-900/10 p-8 rounded-[3rem] border border-indigo-100 dark:border-indigo-800">
                <VoiceAssistant 
                  tasks={tasks} 
                  onAddTask={(t) => setTasks(prev => [...prev, t])} 
                  onDeleteTask={(id) => setTasks(prev => prev.filter(x => x.id !== id))} 
                  onUpdateTask={(id, updates) => setTasks(prev => prev.map(x => x.id === id ? { ...x, ...updates } : x))} 
                  onPlayBriefing={handlePlayBriefing} 
                  selectedVoice={selectedVoice} 
                />
               </div>
               <p className="text-xs text-center text-slate-400 dark:text-slate-500 px-6">
                 Ich höre dir zu. Sprich einfach mit mir, um Aufgaben hinzuzufügen oder deinen Tag zu planen.
               </p>
            </div>
          )}

          {isPanelOpen === 'settings' && (
            <div className="space-y-10">
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2"><User className="w-4 h-4 text-indigo-500" /><h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Profil</h3></div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Nutzername</label>
                  <input type="text" value={userProfile.name} onChange={(e) => setUserProfile(p => ({ ...p, name: e.target.value }))} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none" placeholder="Dein Name" />
                </div>
              </div>
              
              <div className="space-y-4">
                 <div className="flex items-center gap-2 mb-2"><Volume2 className="w-4 h-4 text-indigo-500" /><h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Stimme wählen</h3></div>
                <div className="grid grid-cols-1 gap-2">
                  {VOICES.map(v => (
                    <div key={v.id} className="flex items-center gap-2">
                      <button onClick={() => setSelectedVoice(v.id)} className={`flex-1 p-3 rounded-xl border-2 transition-all text-xs font-bold text-left flex items-center justify-between ${selectedVoice === v.id ? 'border-indigo-500 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30' : 'border-slate-100 dark:border-slate-800 text-slate-400'}`}><span>{v.name} ({v.label})</span>{selectedVoice === v.id && <Check className="w-4 h-4" />}</button>
                      <button onClick={() => handlePreviewVoice(v.id)} className={`p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 ${isPreviewingVoice === v.id ? 'animate-pulse text-indigo-500' : ''}`}><Play className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-8 border-t dark:border-slate-800">
                <button onClick={handleClearChat} className="w-full flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl font-bold"><Trash2 className="w-5 h-5" />Chatverlauf leeren</button>
              </div>
            </div>
          )}
        </div>
      </div>

      <header className="px-6 py-4 flex items-center justify-between border-b dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center">{isLogoLoading ? <Loader2 className="w-4 h-4 animate-spin text-indigo-500" /> : appLogoUrl ? <img src={appLogoUrl} alt="Logo" className="w-full h-full object-cover" /> : <Brain className="w-5 h-5 text-indigo-500" />}</div>
          <h1 className="font-black text-lg tracking-tighter">NoteHub</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">{isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}</button>
          <button onClick={() => setIsPanelOpen('voice')} className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500"><Mic className="w-5 h-5" /></button>
          <button onClick={() => setIsPanelOpen('settings')} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800"><Settings className="w-5 h-5" /></button>
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative pb-20 md:pb-0">
        {/* TASK SECTION (PLAN) */}
        <section className={`
          flex-1 flex flex-col overflow-y-auto p-6 gap-6 custom-scrollbar
          ${activeTab === 'plan' ? 'flex' : 'hidden md:flex'}
          md:w-[40%] lg:w-[35%] xl:w-[30%] md:max-w-md md:border-r md:dark:border-slate-800 md:bg-slate-50/30 md:dark:bg-slate-950/30
        `}>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black">Dein Plan</h2>
            <div className="flex items-center gap-2 relative" ref={voicePickerRef}>
              <button onClick={handleExportCSV} className="p-2 bg-white dark:bg-slate-800 text-slate-500 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm hover:text-indigo-500 transition-colors" title="Export als CSV"><Download className="w-4 h-4" /></button>
              <button onClick={handleExportTXT} className="p-2 bg-white dark:bg-slate-800 text-slate-500 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm hover:text-indigo-500 transition-colors" title="Export als Textdatei"><FileText className="w-4 h-4" /></button>
              
              <div className="relative">
                <button onClick={() => setShowVoicePicker(!showVoicePicker)} className="p-2 bg-white dark:bg-slate-800 text-indigo-500 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm hover:scale-105 transition-transform">
                  <UserCircle className="w-4 h-4" />
                </button>
                {showVoicePicker && (
                  <div className="absolute top-full right-0 mt-2 z-[150] w-48 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl p-2 animate-in fade-in zoom-in-95 duration-200">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-3 py-1 mb-1">Briefing Stimme</p>
                    {VOICES.map(v => (
                      <div key={v.id} className="flex items-center gap-1">
                        <button 
                          onClick={() => { setSelectedVoice(v.id); setShowVoicePicker(false); }}
                          className={`flex-1 text-left px-3 py-2 rounded-xl text-[11px] font-bold flex items-center justify-between ${selectedVoice === v.id ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                        >
                          {v.name}
                          {selectedVoice === v.id && <Check className="w-3 h-3" />}
                        </button>
                        <button onClick={() => handlePreviewVoice(v.id)} className="p-2 text-slate-300 hover:text-indigo-500">
                          {isPreviewingVoice === v.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button onClick={handlePlayBriefing} disabled={isBriefingLoading} className="p-2 bg-white dark:bg-slate-800 text-indigo-500 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">{isBriefingLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}</button>
              <button onClick={() => setTasks([...tasks, { id: Math.random().toString(36).substr(2, 9), title: 'Neue Aufgabe', completed: false, priority: 'medium', category: 'Allgemein' }])} className="p-2 bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-500/20"><Plus className="w-4 h-4" /></button>
            </div>
          </div>
          <MoodTracker currentMood={userStats.mood} onMoodSelect={(m) => setUserStats({ ...userStats, mood: m })} />
          <div className="space-y-3 pb-24">
            {tasks.map(task => (<TaskItem key={task.id} task={task} onToggle={(id) => setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t))} onDelete={(id) => setTasks(tasks.filter(t => t.id !== id))} onUpdate={(id, updates) => setTasks(tasks.map(t => t.id === id ? { ...t, ...updates } : t))} onToggleImportant={(id) => setTasks(tasks.map(t => t.id === id ? { ...t, isImportant: !t.isImportant } : t))} />))}
            {tasks.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 opacity-30 text-center">
                 <ListTodo className="w-12 h-12 mb-4" />
                 <p className="text-sm font-bold">Noch keine Aufgaben</p>
                 <p className="text-[10px] uppercase tracking-widest mt-1">Chatte mit NoteHub zum Planen</p>
              </div>
            )}
          </div>
        </section>

        {/* CHAT SECTION */}
        <section className={`
          flex-1 border-l dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col h-full relative overflow-hidden
          ${activeTab === 'chat' ? 'flex' : 'hidden md:flex'}
        `}>
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar pb-32">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-4 rounded-[1.8rem] relative group ${msg.role === 'user' ? 'bg-indigo-500 text-white rounded-tr-none shadow-md shadow-indigo-500/10' : 'bg-slate-100 dark:bg-slate-800 dark:text-slate-100 rounded-tl-none shadow-sm'}`}>
                  {msg.image && <img src={msg.image} className="w-full rounded-2xl mb-2" alt="Anhang" />}
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                  {msg.role === 'model' && (
                    <button onClick={() => handlePlayMessage(msg.text)} className="absolute -right-9 bottom-0 p-2 text-slate-300 hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity"><Volume2 className="w-4 h-4" /></button>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <ThoughtVisualizer active={isLoading} profile={userProfile} />

          <div className="p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-t dark:border-slate-800 absolute bottom-0 inset-x-0 pb-6 md:pb-4">
            <form onSubmit={handleSendMessage} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-full border border-transparent focus-within:border-indigo-500/30 transition-all shadow-inner">
              <button type="button" onClick={toggleMic} className={`p-2.5 rounded-full transition-all ${isListening ? 'bg-red-500 text-white animate-pulse shadow-lg shadow-red-500/20' : 'text-slate-400 hover:text-indigo-500'}`} title={isListening ? "Stoppen" : "Sprechen"}><Mic className="w-5 h-5" /></button>
              <input value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder="Frag NoteHub..." className="flex-1 bg-transparent border-none outline-none text-sm px-2 py-2" />
              <button type="submit" disabled={isLoading} className="p-2.5 bg-indigo-500 text-white rounded-full disabled:opacity-50 hover:bg-indigo-600 transition-colors shadow-lg shadow-indigo-500/20">{isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}</button>
            </form>
          </div>
        </section>

        {/* MOBILE BOTTOM NAVIGATION */}
        <nav className="fixed bottom-0 inset-x-0 h-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t dark:border-slate-800 flex items-center justify-around md:hidden z-50 px-6">
          <button 
            onClick={() => setActiveTab('plan')} 
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'plan' ? 'text-indigo-500 scale-110' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
          >
            <div className="relative">
              <ListTodo className="w-6 h-6" />
              {openTasksCount > 0 && activeTab !== 'plan' && (
                <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-[10px] text-white font-black rounded-full flex items-center justify-center animate-bounce">
                  {openTasksCount}
                </span>
              )}
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest">Plan</span>
          </button>
          
          <button 
            onClick={() => setActiveTab('chat')} 
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === 'chat' ? 'text-indigo-500 scale-110' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
          >
            <MessageSquare className="w-6 h-6" />
            <span className="text-[9px] font-black uppercase tracking-widest">Chat</span>
          </button>
        </nav>
      </main>

      {/* Persistent Notification Overlay (Only for reminders) */}
      {activeNotification && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={() => setActiveNotification(null)} />
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-xs rounded-[2.5rem] p-8 shadow-2xl border dark:border-slate-800 text-center flex flex-col items-center">
            <Bell className="w-10 h-10 text-indigo-500 mb-6" />
            <h3 className="text-xl font-black mb-1">{activeNotification.title}</h3>
            <p className="text-xs text-slate-400 mb-8">Erinnerung für {activeNotification.reminderAt}</p>
            <button onClick={() => { setTasks(tasks.map(t => t.id === activeNotification.id ? { ...t, completed: true } : t)); setActiveNotification(null); }} className="w-full py-3.5 bg-indigo-600 text-white rounded-2xl font-bold">Erledigt</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
