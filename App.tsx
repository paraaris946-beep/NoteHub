
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
  Square
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

const ThoughtVisualizer: React.FC<{ active: boolean; profile: UserProfile; tasksCount: number }> = ({ active, profile, tasksCount }) => {
  if (!active) return null;
  return (
    <div className="absolute bottom-full left-0 right-0 mb-4 px-6 animate-in fade-in slide-in-from-bottom-4 duration-500 z-30">
      <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-indigo-500/20 rounded-[2rem] p-6 shadow-2xl shadow-indigo-500/10 overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent animate-pulse" />
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-indigo-500 animate-pulse" />
            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">NoteHub denkt nach...</span>
          </div>
          <div className="flex gap-1">
            {[1, 2, 3].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: `${i * 0.1}s` }} />)}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 p-3 rounded-2xl border border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-900/20">
            <User className="w-3.5 h-3.5 text-indigo-500" />
            <span className="text-[11px] font-bold truncate dark:text-slate-200">{profile.name || "Assistent bereit"}</span>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-2xl border border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-900/20">
            <LayoutDashboard className="w-3.5 h-3.5 text-indigo-500" />
            <span className="text-[11px] font-bold truncate dark:text-slate-200">{tasksCount} Einträge</span>
          </div>
        </div>
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
  const [showPlan, setShowPlan] = useState(tasks.length > 0);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showVoiceOverlay, setShowVoiceOverlay] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState(() => localStorage.getItem('minicoach_voice') || 'Kore');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('minicoach_theme');
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });
  const [isPreviewingVoice, setIsPreviewingVoice] = useState<string | null>(null);
  
  // Audio Playback State
  const [playbackState, setPlaybackState] = useState<'idle' | 'playing' | 'paused'>('idle');
  const [playbackLabel, setPlaybackLabel] = useState<string>('');
  const playbackCtxRef = useRef<AudioContext | null>(null);
  const playbackSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const [activeNotification, setActiveNotification] = useState<Task | null>(null);
  const triggeredRemindersRef = useRef<Set<string>>(new Set());
  const tasksRef = useRef<Task[]>(tasks);

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
      recognitionRef.current.lang = 'de-DE';
      recognitionRef.current.onstart = () => setIsListening(true);
      recognitionRef.current.onend = () => setIsListening(false);
      recognitionRef.current.onresult = (e: any) => {
        const transcript = e.results[0][0].transcript;
        setUserInput(prev => (prev.trim() ? prev.trim() + ' ' : '') + transcript);
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

    return () => clearInterval(interval);
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
      setIsSettingsOpen(false);
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

  // Central Audio Playback Handler
  const playAudio = async (audioBase64: string, label: string) => {
    // Stop any existing playback
    handleStopPlayback();

    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    playbackCtxRef.current = ctx;
    
    try {
      const buf = await decodeAudioData(decodeBase64(audioBase64), ctx, 24000, 1);
      const source = ctx.createBufferSource();
      source.buffer = buf;
      source.connect(ctx.destination);
      playbackSourceRef.current = source;
      
      source.onended = () => {
        setPlaybackState('idle');
        setPlaybackLabel('');
      };

      setPlaybackLabel(label);
      setPlaybackState('playing');
      source.start();
    } catch (err) {
      console.error("Playback error", err);
      setPlaybackState('idle');
    }
  };

  const handleTogglePlayback = async () => {
    if (!playbackCtxRef.current) return;
    if (playbackState === 'playing') {
      await playbackCtxRef.current.suspend();
      setPlaybackState('paused');
    } else if (playbackState === 'paused') {
      await playbackCtxRef.current.resume();
      setPlaybackState('playing');
    }
  };

  const handleStopPlayback = () => {
    if (playbackSourceRef.current) {
      try { playbackSourceRef.current.stop(); } catch (e) {}
      playbackSourceRef.current = null;
    }
    if (playbackCtxRef.current) {
      playbackCtxRef.current.close();
      playbackCtxRef.current = null;
    }
    setPlaybackState('idle');
    setPlaybackLabel('');
  };

  const handlePlayBriefing = async () => {
    if (isBriefingLoading) return;
    setIsBriefingLoading(true);
    try {
      const audio = await generateBriefingAudio(tasks, dayPlan?.focus, dayPlan?.motivation, selectedVoice);
      await playAudio(audio, 'Tages-Briefing');
    } catch (err) {
      console.error("Briefing failed", err);
    } finally {
      setIsBriefingLoading(false);
    }
  };

  const handlePlayMessage = async (text: string) => {
    try {
      const audio = await generateMessageAudio(text, selectedVoice);
      await playAudio(audio, 'Nachricht vorlesen');
    } catch (err) {
      console.error("Message audio failed", err);
    }
  };

  const handlePreviewVoice = async (voiceId: string) => {
    if (isPreviewingVoice) return;
    setIsPreviewingVoice(voiceId);
    try {
      const text = `Hallo, ich bin die Stimme ${voiceId}.`;
      const audio = await generateMessageAudio(text, voiceId);
      await playAudio(audio, `Vorschau: ${voiceId}`);
    } catch (err) {
      console.error("Voice preview failed", err);
    } finally {
      setIsPreviewingVoice(null);
    }
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
          setShowPlan(true);
        } catch (err) { console.error("JSON parse failed", err); }
      }
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'model', text: cleanText, timestamp: new Date() }]);
    } catch (err) { console.error("Chat message failed", err); }
    finally { setIsLoading(false); }
  };

  return (
    <div className={`min-h-screen flex flex-col ${isDarkMode ? 'dark bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* Audio Playback Controls Overlay */}
      {playbackState !== 'idle' && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[150] w-[90%] max-w-sm animate-in slide-in-from-bottom-8 fade-in duration-500">
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-indigo-500/30 p-4 rounded-[2.5rem] shadow-2xl flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-500 flex items-center justify-center relative overflow-hidden shrink-0">
               <div className="absolute inset-0 opacity-20">
                  <div className={`w-full h-full bg-gradient-to-t from-white to-transparent ${playbackState === 'playing' ? 'animate-pulse' : ''}`} />
               </div>
               {playbackState === 'playing' ? <Volume2 className="w-6 h-6 text-white" /> : <Pause className="w-6 h-6 text-white" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest truncate">{playbackLabel}</p>
              <p className="text-xs font-bold dark:text-slate-200 truncate">{playbackState === 'playing' ? 'Wird abgespielt...' : 'Pausiert'}</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleTogglePlayback} className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-slate-200 transition-all">
                {playbackState === 'playing' ? <Pause className="w-5 h-5 text-slate-600 dark:text-slate-300" /> : <Play className="w-5 h-5 text-indigo-500" />}
              </button>
              <button onClick={handleStopPlayback} className="p-3 bg-slate-100 dark:bg-slate-800 rounded-full hover:bg-red-500 hover:text-white transition-all">
                <Square className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {showVoiceOverlay && (
        <div className="fixed inset-0 z-[200] bg-slate-950/90 backdrop-blur-xl flex flex-col items-center justify-center p-8 animate-in fade-in zoom-in-95 duration-300">
          <button onClick={() => setShowVoiceOverlay(false)} className="absolute top-8 right-8 p-4 bg-white/10 hover:bg-white/20 text-white rounded-full transition-all"><X className="w-8 h-8" /></button>
          <div className="w-full max-w-sm">
             <VoiceAssistant tasks={tasks} onAddTask={(t) => setTasks(prev => [...prev, t])} onDeleteTask={(id) => setTasks(prev => prev.filter(x => x.id !== id))} onUpdateTask={(id, updates) => setTasks(prev => prev.map(x => x.id === id ? { ...x, ...updates } : x))} onPlayBriefing={handlePlayBriefing} selectedVoice={selectedVoice} />
          </div>
        </div>
      )}

      {activeNotification && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xl" onClick={() => setActiveNotification(null)} />
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-sm rounded-[3rem] p-10 shadow-2xl border-2 border-indigo-500/30 text-center animate-in zoom-in-95 duration-500 flex flex-col items-center">
            <Bell className="w-12 h-12 text-indigo-500 mb-6 animate-bounce" />
            <h3 className="text-2xl font-black mb-2">{activeNotification.title}</h3>
            <p className="text-sm text-slate-400 mb-8">Erinnerung für {activeNotification.reminderAt} Uhr</p>
            <button onClick={() => { setTasks(tasks.map(t => t.id === activeNotification.id ? { ...t, completed: true } : t)); setActiveNotification(null); }} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-500/20">Erledigt</button>
          </div>
        </div>
      )}

      <header className="p-4 flex items-center justify-between border-b dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center">{isLogoLoading ? <Loader2 className="w-5 h-5 animate-spin text-indigo-500" /> : appLogoUrl ? <img src={appLogoUrl} alt="Logo" className="w-full h-full object-cover" /> : <Brain className="w-6 h-6 text-indigo-500" />}</div>
          <h1 className="font-black text-xl tracking-tighter">NoteHub</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">{isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}</button>
          <button onClick={() => setIsSettingsOpen(!isSettingsOpen)} className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"><Settings className="w-5 h-5" /></button>
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <section className={`flex-1 flex flex-col overflow-y-auto p-4 gap-6 custom-scrollbar ${showPlan ? 'block' : 'hidden md:flex md:w-2/5'}`}>
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black">Dein Plan</h2>
            <div className="flex items-center gap-2">
              <button onClick={handleExportCSV} className="p-2.5 bg-white dark:bg-slate-800 text-slate-500 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 hover:scale-105 transition-all" title="CSV exportieren"><Download className="w-5 h-5" /></button>
              <button onClick={handlePlayBriefing} disabled={isBriefingLoading} className="p-2.5 bg-white dark:bg-slate-800 text-indigo-500 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 hover:scale-105 transition-all disabled:opacity-50" title="Tages-Briefing">{isBriefingLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Volume2 className="w-5 h-5" />}</button>
              <button onClick={() => setTasks([...tasks, { id: Math.random().toString(36).substr(2, 9), title: 'Neue Aufgabe', completed: false, priority: 'medium', category: 'Allgemein' }])} className="p-2.5 bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-500/20 hover:bg-indigo-600 transition-all"><Plus className="w-5 h-5" /></button>
            </div>
          </div>
          <MoodTracker currentMood={userStats.mood} onMoodSelect={(m) => setUserStats({ ...userStats, mood: m })} />
          <div className="space-y-4">
            {tasks.map(task => (<TaskItem key={task.id} task={task} onToggle={(id) => setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t))} onDelete={(id) => setTasks(tasks.filter(t => t.id !== id))} onUpdate={(id, updates) => setTasks(tasks.map(t => t.id === id ? { ...t, ...updates } : t))} onToggleImportant={(id) => setTasks(tasks.map(t => t.id === id ? { ...t, isImportant: !t.isImportant } : t))} />))}
          </div>
          <div className="mt-auto pt-6 border-t dark:border-slate-800">
             <div className="bg-indigo-50/30 dark:bg-indigo-900/10 p-6 rounded-[2.5rem] border border-indigo-100 dark:border-indigo-800">
                <VoiceAssistant tasks={tasks} onAddTask={(t) => setTasks(prev => [...prev, t])} onDeleteTask={(id) => setTasks(prev => prev.filter(x => x.id !== id))} onUpdateTask={(id, updates) => setTasks(prev => prev.map(x => x.id === id ? { ...x, ...updates } : x))} onPlayBriefing={handlePlayBriefing} selectedVoice={selectedVoice} />
             </div>
          </div>
        </section>

        <section className="flex-1 border-l dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col h-full relative">
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-4 rounded-[2rem] relative group ${msg.role === 'user' ? 'bg-indigo-500 text-white rounded-tr-none' : 'bg-slate-100 dark:bg-slate-800 dark:text-slate-100 rounded-tl-none'}`}>
                  {msg.image && <img src={msg.image} className="w-full rounded-2xl mb-2" alt="Anhang" />}
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                  
                  {msg.role === 'model' && (
                    <button 
                      onClick={() => handlePlayMessage(msg.text)}
                      className="absolute -right-10 bottom-0 p-2 text-slate-300 hover:text-indigo-500 transition-colors opacity-0 group-hover:opacity-100"
                      title="Antwort vorlesen"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <ThoughtVisualizer active={isLoading} profile={userProfile} tasksCount={tasks.length} />

          <div className="p-4 bg-white dark:bg-slate-900 border-t dark:border-slate-800">
            <form onSubmit={handleSendMessage} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-2 rounded-[2rem] border border-transparent focus-within:border-indigo-500/30 transition-all">
              <button type="button" onClick={() => recognitionRef.current?.start()} className={`p-3 rounded-full transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'text-slate-400 hover:text-indigo-500'}`}><Mic className="w-5 h-5" /></button>
              <input value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder="Frag NoteHub oder sag 'Plan mir den Tag'..." className="flex-1 bg-transparent border-none outline-none text-sm dark:text-white px-2" />
              <button type="submit" disabled={isLoading} className="p-3 bg-indigo-500 text-white rounded-full hover:bg-indigo-600 transition-all disabled:opacity-50">{isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}</button>
            </form>
          </div>
        </section>
      </main>

      {isSettingsOpen && (
        <div className="fixed inset-0 z-[250] bg-black/40 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] p-8 space-y-8 shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between shrink-0">
              <h2 className="text-xl font-bold dark:text-white">Einstellungen</h2>
              <button onClick={() => setIsSettingsOpen(false)}><X className="w-6 h-6 text-slate-400" /></button>
            </div>
            <div className="space-y-8 overflow-y-auto custom-scrollbar px-1">
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2"><User className="w-4 h-4 text-indigo-500" /><h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Profil</h3></div>
                <div className="space-y-2"><label className="text-[10px] font-bold text-slate-400 uppercase ml-1">Nutzername</label><input type="text" value={userProfile.name} onChange={(e) => setUserProfile(p => ({ ...p, name: e.target.value }))} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl outline-none focus:ring-2 ring-indigo-500/20" placeholder="Dein Name" /></div>
              </div>
              <div className="space-y-4">
                 <div className="flex items-center gap-2 mb-2"><Volume2 className="w-4 h-4 text-indigo-500" /><h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Stimme wählen</h3></div>
                <div className="grid grid-cols-1 gap-2">
                  {VOICES.map(v => (
                    <div key={v.id} className="flex items-center gap-2">
                      <button onClick={() => setSelectedVoice(v.id)} className={`flex-1 p-3 rounded-xl border-2 transition-all text-xs font-bold text-left flex items-center justify-between ${selectedVoice === v.id ? 'border-indigo-500 bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30' : 'border-slate-100 dark:border-slate-800 text-slate-400'}`}><span>{v.name} ({v.label})</span>{selectedVoice === v.id && <Check className="w-4 h-4" />}</button>
                      <button onClick={() => handlePreviewVoice(v.id)} className={`p-3 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-indigo-500 transition-colors ${isPreviewingVoice === v.id ? 'animate-pulse text-indigo-500' : ''}`} title="Vorschau anhören">{isPreviewingVoice === v.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}</button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2"><Sparkles className="w-4 h-4 text-indigo-500" /><h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Live-Unterhaltung</h3></div>
                <button onClick={() => { setShowVoiceOverlay(true); setIsSettingsOpen(false); }} className="w-full flex items-center justify-between p-4 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-all active:scale-[0.98]"><div className="flex items-center gap-3"><Headphones className="w-5 h-5" /><span className="font-bold">Live Voice starten</span></div><ChevronDown className="w-5 h-5 -rotate-90 opacity-50" /></button>
              </div>
              <div className="space-y-4 pt-4 border-t dark:border-slate-800">
                <div className="flex items-center gap-2 mb-2"><Trash2 className="w-4 h-4 text-red-500" /><h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Datenverwaltung</h3></div>
                <button onClick={handleClearChat} className="w-full flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-2xl font-bold hover:bg-red-100 transition-all active:scale-[0.98]"><Trash2 className="w-5 h-5" />Chatverlauf leeren</button>
              </div>
            </div>
            <button onClick={() => setIsSettingsOpen(false)} className="w-full bg-slate-800 dark:bg-indigo-600 text-white py-4 rounded-2xl font-bold shadow-lg mt-8 shrink-0">Fertig</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
