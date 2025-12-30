
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
  ChevronRight
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
    <div className="absolute bottom-20 left-6 right-6 z-30 animate-in fade-in slide-in-from-bottom-2 duration-300">
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
  const [showPlan, setShowPlan] = useState(tasks.length > 0);
  const [isPanelOpen, setIsPanelOpen] = useState<'none' | 'settings' | 'voice'>('none');
  const [isListening, setIsListening] = useState(false);
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

  const playAudio = async (audioBase64: string, label: string) => {
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
          setShowPlan(true);
        } catch (err) { console.error("JSON parse failed", err); }
      }
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'model', text: cleanText, timestamp: new Date() }]);
    } catch (err) { console.error("Chat message failed", err); }
    finally { setIsLoading(false); }
  };

  return (
    <div className={`h-screen flex flex-col overflow-hidden ${isDarkMode ? 'dark bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* Audio Playback Controls Overlay - DOCKED TO BOTTOM */}
      {playbackState !== 'idle' && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-sm animate-in slide-in-from-bottom-4 fade-in duration-500">
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
        {/* Panel Backdrop - semi-transparent to keep "setup" visible */}
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

      <header className="px-6 py-4 flex items-center justify-between border-b dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
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

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        <section className={`flex-1 flex flex-col overflow-y-auto p-6 gap-6 custom-scrollbar ${showPlan ? 'block' : 'hidden md:flex md:w-[38%]'}`}>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black">Dein Plan</h2>
            <div className="flex items-center gap-2">
              <button onClick={handleExportCSV} className="p-2 bg-white dark:bg-slate-800 text-slate-500 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm"><Download className="w-4 h-4" /></button>
              <button onClick={handlePlayBriefing} disabled={isBriefingLoading} className="p-2 bg-white dark:bg-slate-800 text-indigo-500 rounded-xl border border-slate-100 dark:border-slate-700 shadow-sm">{isBriefingLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}</button>
              <button onClick={() => setTasks([...tasks, { id: Math.random().toString(36).substr(2, 9), title: 'Neue Aufgabe', completed: false, priority: 'medium', category: 'Allgemein' }])} className="p-2 bg-indigo-500 text-white rounded-xl shadow-lg shadow-indigo-500/20"><Plus className="w-4 h-4" /></button>
            </div>
          </div>
          <MoodTracker currentMood={userStats.mood} onMoodSelect={(m) => setUserStats({ ...userStats, mood: m })} />
          <div className="space-y-3 pb-20">
            {tasks.map(task => (<TaskItem key={task.id} task={task} onToggle={(id) => setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t))} onDelete={(id) => setTasks(tasks.filter(t => t.id !== id))} onUpdate={(id, updates) => setTasks(tasks.map(t => t.id === id ? { ...t, ...updates } : t))} onToggleImportant={(id) => setTasks(tasks.map(t => t.id === id ? { ...t, isImportant: !t.isImportant } : t))} />))}
          </div>
        </section>

        <section className="flex-1 border-l dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col h-full relative overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar pb-32">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-4 rounded-[1.8rem] relative group ${msg.role === 'user' ? 'bg-indigo-500 text-white rounded-tr-none' : 'bg-slate-100 dark:bg-slate-800 dark:text-slate-100 rounded-tl-none'}`}>
                  {msg.image && <img src={msg.image} className="w-full rounded-2xl mb-2" alt="Anhang" />}
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                  {msg.role === 'model' && (
                    <button onClick={() => handlePlayMessage(msg.text)} className="absolute -right-9 bottom-0 p-2 text-slate-300 hover:text-indigo-500 opacity-0 group-hover:opacity-100"><Volume2 className="w-4 h-4" /></button>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <ThoughtVisualizer active={isLoading} profile={userProfile} />

          <div className="p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-t dark:border-slate-800 absolute bottom-0 inset-x-0">
            <form onSubmit={handleSendMessage} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-full border border-transparent focus-within:border-indigo-500/30">
              <button type="button" onClick={() => recognitionRef.current?.start()} className={`p-2.5 rounded-full ${isListening ? 'bg-red-500 text-white animate-pulse' : 'text-slate-400'}`}><Mic className="w-5 h-5" /></button>
              <input value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder="Frag NoteHub..." className="flex-1 bg-transparent border-none outline-none text-sm px-2" />
              <button type="submit" disabled={isLoading} className="p-2.5 bg-indigo-500 text-white rounded-full disabled:opacity-50">{isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}</button>
            </form>
          </div>
        </section>
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
