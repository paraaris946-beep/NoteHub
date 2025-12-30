
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
  ListTodo,
  Calendar,
  Type as FontType
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
    <div className="px-6 py-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-indigo-500/30 rounded-2xl py-2 px-4 shadow-sm flex items-center gap-3 w-fit">
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
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'de-DE';
      
      recognitionRef.current.onstart = () => setIsListening(true);
      recognitionRef.current.onend = () => setIsListening(false);
      recognitionRef.current.onresult = (e: any) => {
        const transcript = Array.from(e.results).map((result: any) => result[0].transcript).join('');
        setUserInput(transcript);
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
        // Voice picker logic removed to simplify
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
    } catch (err) { console.error(err); }
    finally { setIsLogoLoading(false); }
  };

  const handleClearChat = () => {
    if (window.confirm('Verlauf löschen?')) {
      setMessages([INITIAL_MESSAGE]);
      setIsPanelOpen('none');
    }
  };

  const handleExportCSV = () => {
    if (tasks.length === 0) return;
    const headers = ['Titel', 'Zeit', 'Erledigt'];
    const rows = tasks.map(t => [t.title, t.time || '', t.completed ? 'Ja' : 'Nein']);
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'NoteHub_Plan.csv';
    link.click();
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
    } catch (err) { console.error(err); setPlaybackState('idle'); }
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
    } catch (err) { console.error(err); }
    finally { setIsBriefingLoading(false); }
  };

  const handlePlayMessage = async (text: string) => {
    try {
      const audio = await generateMessageAudio(text, selectedVoice);
      await playAudio(audio, 'Nachricht vorlesen');
    } catch (err) { console.error(err); }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!userInput.trim() && !selectedImage) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: userInput, timestamp: new Date(), image: selectedImage || undefined };
    setMessages(prev => [...prev, userMsg]);
    setUserInput('');
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
        } catch (err) { console.error(err); }
      }
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'model', text: cleanText, timestamp: new Date() }]);
    } catch (err) { console.error(err); }
    finally { setIsLoading(false); }
  };

  const toggleMic = () => {
    if (isListening) recognitionRef.current?.stop();
    else recognitionRef.current?.start();
  };

  return (
    <div className={`h-screen flex flex-col overflow-hidden ${isDarkMode ? 'dark bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      
      {playbackState !== 'idle' && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-sm animate-in slide-in-from-bottom-4">
          <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-indigo-500/30 p-3 rounded-[2rem] shadow-2xl flex items-center gap-4">
            <Volume2 className={`w-5 h-5 text-indigo-500 ${playbackState === 'playing' ? 'animate-pulse' : ''}`} />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold truncate">{playbackLabel}</p>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={handleTogglePlayback} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full">
                {playbackState === 'playing' ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>
              <button onClick={handleStopPlayback} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full"><Square className="w-4 h-4" /></button>
            </div>
          </div>
        </div>
      )}

      <header className="px-6 py-4 flex items-center justify-between border-b dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
        <div className="flex items-center gap-3">
          <Brain className="w-6 h-6 text-indigo-500" />
          <h1 className="font-black text-lg">NoteHub</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-xl">{isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}</button>
          <button onClick={() => setIsPanelOpen('voice')} className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500"><Mic className="w-5 h-5" /></button>
          <button onClick={() => setIsPanelOpen('settings')} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800"><Settings className="w-5 h-5" /></button>
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row overflow-hidden relative pb-20 md:pb-0">
        {/* Plan Tab */}
        <section className={`flex-1 flex flex-col overflow-y-auto p-6 gap-6 custom-scrollbar ${activeTab === 'plan' ? 'flex' : 'hidden md:flex'}`}>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black">Plan</h2>
            <div className="flex items-center gap-2">
              <button onClick={handleExportCSV} className="p-2 bg-white dark:bg-slate-800 rounded-xl"><Download className="w-4 h-4" /></button>
              <button onClick={handlePlayBriefing} disabled={isBriefingLoading} className="p-2 bg-white dark:bg-slate-800 text-indigo-500 rounded-xl">{isBriefingLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}</button>
              <button onClick={() => setTasks([...tasks, { id: Math.random().toString(), title: 'Neue Aufgabe', completed: false, priority: 'medium', category: 'General' }])} className="p-2 bg-indigo-500 text-white rounded-xl"><Plus className="w-4 h-4" /></button>
            </div>
          </div>
          <MoodTracker currentMood={userStats.mood} onMoodSelect={(m) => setUserStats({ ...userStats, mood: m })} />
          <div className="space-y-3 pb-8">
            {tasks.map(task => (<TaskItem key={task.id} task={task} onToggle={(id) => setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t))} onDelete={(id) => setTasks(tasks.filter(t => t.id !== id))} onUpdate={(id, updates) => setTasks(tasks.map(t => t.id === id ? { ...t, ...updates } : t))} onToggleImportant={(id) => setTasks(tasks.map(t => t.id === id ? { ...t, isImportant: !t.isImportant } : t))} />))}
          </div>
        </section>

        {/* Chat Tab */}
        <section className={`flex-1 border-l dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col overflow-hidden ${activeTab === 'chat' ? 'flex' : 'hidden md:flex'}`}>
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-4 rounded-[1.8rem] relative group ${msg.role === 'user' ? 'bg-indigo-500 text-white' : 'bg-slate-100 dark:bg-slate-800 dark:text-slate-100'}`}>
                  <p className="text-sm leading-relaxed">{msg.text}</p>
                  {msg.role === 'model' && (
                    <button onClick={() => handlePlayMessage(msg.text)} className="absolute -right-9 bottom-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity"><Volume2 className="w-4 h-4" /></button>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <ThoughtVisualizer active={isLoading} profile={userProfile} />

          {/* Fixed Chat Input for this column, but inside the flex flow */}
          <div className="p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-t dark:border-slate-800 shrink-0">
            <form onSubmit={handleSendMessage} className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-full shadow-sm">
              <button type="button" onClick={toggleMic} className={`p-2.5 rounded-full ${isListening ? 'bg-red-500 text-white' : 'text-slate-400'}`}><Mic className="w-5 h-5" /></button>
              <input value={userInput} onChange={(e) => setUserInput(e.target.value)} placeholder="NoteHub fragen..." className="flex-1 bg-transparent border-none outline-none text-sm px-2 py-2" />
              <button type="submit" disabled={isLoading} className="p-2.5 bg-indigo-500 text-white rounded-full">{isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}</button>
            </form>
          </div>
        </section>

        {/* Tab Navigation for Mobile */}
        <nav className="fixed bottom-0 inset-x-0 h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t dark:border-slate-800 flex items-center justify-around md:hidden z-50 shadow-lg">
          <button onClick={() => setActiveTab('plan')} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'plan' ? 'text-indigo-500' : 'text-slate-400'}`}>
            <ListTodo className="w-5 h-5" />
            <span className="text-[9px] font-black uppercase tracking-widest">Plan</span>
          </button>
          <button onClick={() => setActiveTab('chat')} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'chat' ? 'text-indigo-500' : 'text-slate-400'}`}>
            <MessageSquare className="w-5 h-5" />
            <span className="text-[9px] font-black uppercase tracking-widest">Chat</span>
          </button>
        </nav>
      </main>

      {activeNotification && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 animate-in fade-in">
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={() => setActiveNotification(null)} />
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-xs rounded-[2.5rem] p-8 text-center">
            <Bell className="w-10 h-10 text-indigo-500 mx-auto mb-6" />
            <h3 className="text-xl font-black mb-1">{activeNotification.title}</h3>
            <button onClick={() => setActiveNotification(null)} className="w-full py-3.5 bg-indigo-600 text-white rounded-2xl font-bold">OK</button>
          </div>
        </div>
      )}

      {isPanelOpen !== 'none' && (
        <div className="fixed inset-y-0 right-0 z-[200] w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl p-8 overflow-y-auto">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-xl font-bold">{isPanelOpen === 'settings' ? 'Einstellungen' : 'Voice'}</h2>
            <button onClick={() => setIsPanelOpen('none')} className="p-2"><X className="w-6 h-6" /></button>
          </div>
          
          {isPanelOpen === 'voice' && <VoiceAssistant tasks={tasks} onAddTask={(t) => setTasks([...tasks, t])} onDeleteTask={(id) => setTasks(tasks.filter(t => t.id !== id))} onUpdateTask={(id, updates) => setTasks(tasks.map(t => t.id === id ? { ...t, ...updates } : t))} onPlayBriefing={handlePlayBriefing} selectedVoice={selectedVoice} />}
          
          {isPanelOpen === 'settings' && (
            <div className="space-y-10">
              {/* Profile Section */}
              <section className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
                    <UserCircle className="w-5 h-5 text-indigo-500" />
                  </div>
                  <h3 className="font-black text-sm uppercase tracking-widest text-slate-400">Dein Profil</h3>
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Name</label>
                    <div className="relative flex items-center">
                      <FontType className="absolute left-4 w-4 h-4 text-slate-300" />
                      <input 
                        type="text" 
                        value={userProfile.name}
                        onChange={(e) => setUserProfile({ ...userProfile, name: e.target.value })}
                        placeholder="Dein Name"
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Geburtsdatum</label>
                    <div className="relative flex items-center">
                      <Calendar className="absolute left-4 w-4 h-4 text-slate-300" />
                      <input 
                        type="date" 
                        value={userProfile.birthDate}
                        onChange={(e) => setUserProfile({ ...userProfile, birthDate: e.target.value })}
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20"
                      />
                    </div>
                  </div>
                </div>
              </section>

              {/* Voice Section */}
              <section className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl">
                    <Volume2 className="w-5 h-5 text-indigo-500" />
                  </div>
                  <h3 className="font-black text-sm uppercase tracking-widest text-slate-400">KI-Stimme</h3>
                </div>
                
                <div className="grid grid-cols-1 gap-2">
                  {VOICES.map((voice) => (
                    <button
                      key={voice.id}
                      onClick={() => setSelectedVoice(voice.id)}
                      className={`
                        flex items-center justify-between p-4 rounded-2xl transition-all border-2
                        ${selectedVoice === voice.id 
                          ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-500/30 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                          : 'bg-white dark:bg-slate-900 border-transparent hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500'
                        }
                      `}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${selectedVoice === voice.id ? 'bg-indigo-500' : 'bg-slate-200'}`} />
                        <span className="text-sm font-black uppercase tracking-tight">{voice.name}</span>
                      </div>
                      <span className="text-[10px] font-bold opacity-60">{voice.label}</span>
                    </button>
                  ))}
                </div>
              </section>

              {/* System Section */}
              <section className="space-y-6 pt-4 border-t dark:border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-red-50 dark:bg-red-900/30 rounded-xl">
                    <Trash2 className="w-5 h-5 text-red-500" />
                  </div>
                  <h3 className="font-black text-sm uppercase tracking-widest text-slate-400">Daten & Sicherheit</h3>
                </div>
                
                <button 
                  onClick={handleClearChat} 
                  className="w-full p-5 bg-red-50 dark:bg-red-900/10 text-red-600 rounded-3xl font-black text-xs uppercase tracking-widest hover:bg-red-100 dark:hover:bg-red-900/20 transition-all active:scale-95"
                >
                  Gesamten Chat-Verlauf löschen
                </button>
                
                <p className="text-[10px] text-center text-slate-400 leading-relaxed px-4">
                  Hinweis: Das Löschen des Verlaufs ist endgültig. Deine Aufgabenliste bleibt jedoch erhalten.
                </p>
              </section>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default App;
