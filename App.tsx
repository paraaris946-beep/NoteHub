
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Task, DayPlan, UserStats, Message, UserProfile } from './types';
import { 
  getGeminiClient,
  startCoachingChat, 
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
  Send,
  Volume2,
  Loader2,
  X,
  Moon,
  Sun,
  Plus,
  Brain,
  Bell,
  Play,
  MessageSquare,
  Mic,
  Trash2,
  Download,
  Pause,
  Square,
  UserCircle,
  ListTodo,
  Calendar,
  Type as FontType,
  Edit2
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

const ThoughtVisualizer: React.FC<{ active: boolean }> = ({ active }) => {
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
  const [isLoading, setIsLoading] = useState(false);
  const [isBriefingLoading, setIsBriefingLoading] = useState(false);
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

  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);

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
    
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'de-DE';
      
      recognitionRef.current.onstart = () => setIsListening(true);
      recognitionRef.current.onend = () => setIsListening(false);
      recognitionRef.current.onresult = (e: any) => {
        const transcript = e.results[0][0].transcript;
        setUserInput(prev => prev + (prev ? ' ' : '') + transcript);
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
  }, [isDarkMode]);

  const handleClearChat = () => {
    if (window.confirm('Verlauf löschen?')) {
      setMessages([INITIAL_MESSAGE]);
      setIsPanelOpen('none');
    }
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

  const handleEditMessage = (msg: Message) => {
    setUserInput(msg.text);
    setEditingMessageId(msg.id);
    setActiveTab('chat');
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!userInput.trim()) return;

    const currentInput = userInput;
    setUserInput('');
    setIsLoading(true);

    if (editingMessageId) {
      setMessages(prev => prev.map(m => m.id === editingMessageId ? { ...m, text: currentInput, timestamp: new Date() } : m));
      setEditingMessageId(null);
    } else {
      const userMsg: Message = { id: Date.now().toString(), role: 'user', text: currentInput, timestamp: new Date() };
      setMessages(prev => [...prev, userMsg]);
    }

    try {
      const response = await chatRef.current.sendMessage({ message: currentInput });
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
    <div className={`flex flex-col h-full overflow-hidden ${isDarkMode ? 'dark bg-slate-950 text-white' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* Audio Player Floating Overlay */}
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

      {/* Header */}
      <header className="px-6 py-4 flex items-center justify-between border-b dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
        <div className="flex items-center gap-3">
          <Brain className="w-6 h-6 text-indigo-500" />
          <h1 className="font-black text-lg">NoteHub</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2 rounded-xl active:bg-slate-100 dark:active:bg-slate-800 transition-colors">
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <button onClick={() => setIsPanelOpen('voice')} className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500">
            <Mic className="w-5 h-5" />
          </button>
          <button onClick={() => setIsPanelOpen('settings')} className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800">
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 relative flex flex-col md:flex-row overflow-hidden pb-16 md:pb-0">
        
        {/* Plan Section */}
        <section className={`flex-1 flex flex-col overflow-y-auto p-6 gap-6 custom-scrollbar ${activeTab === 'plan' ? 'flex' : 'hidden md:flex'}`}>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black">Plan</h2>
            <div className="flex items-center gap-2">
              <button onClick={() => setTasks([...tasks, { id: Math.random().toString(), title: 'Neue Aufgabe', completed: false, priority: 'medium', category: 'General' }])} className="p-2.5 bg-indigo-500 text-white rounded-2xl shadow-lg active:scale-95 transition-all">
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>
          <MoodTracker currentMood={userStats.mood} onMoodSelect={(m) => setUserStats({ ...userStats, mood: m })} />
          <div className="space-y-3 pb-4">
            {tasks.map(task => (
              <TaskItem 
                key={task.id} 
                task={task} 
                onToggle={(id) => setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t))} 
                onDelete={(id) => setTasks(tasks.filter(t => t.id !== id))} 
                onUpdate={(id, updates) => setTasks(tasks.map(t => t.id === id ? { ...t, ...updates } : t))} 
                onToggleImportant={(id) => setTasks(tasks.map(t => t.id === id ? { ...t, isImportant: !t.isImportant } : t))} 
              />
            ))}
          </div>
        </section>

        {/* Chat Section */}
        <section className={`flex-1 border-l dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col overflow-hidden ${activeTab === 'chat' ? 'flex' : 'hidden md:flex'}`}>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
            {messages.map(msg => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} group`}>
                <div className={`max-w-[85%] p-4 rounded-[1.8rem] relative ${msg.role === 'user' ? 'bg-indigo-500 text-white' : 'bg-slate-100 dark:bg-slate-800 dark:text-slate-100'}`}>
                  <p className="text-sm leading-relaxed">{msg.text}</p>
                  
                  <div className={`absolute bottom-0 ${msg.role === 'user' ? '-left-10' : '-right-10'} flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity`}>
                    {msg.role === 'user' && (
                      <button onClick={() => handleEditMessage(msg)} className="p-2 text-slate-400 hover:text-indigo-500"><Edit2 className="w-4 h-4" /></button>
                    )}
                    <button onClick={() => handlePlayMessage(msg.text)} className="p-2 text-slate-400 hover:text-indigo-500"><Volume2 className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          <ThoughtVisualizer active={isLoading} />

          {/* Fixed Chat Input Area inside the Chat Column */}
          <div className="p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-t dark:border-slate-800 shrink-0 mb-safe">
            {editingMessageId && (
              <div className="flex items-center justify-between px-4 py-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-t-2xl border-x border-t dark:border-slate-800 text-[10px] font-bold text-indigo-500 uppercase tracking-widest">
                <span>Nachricht bearbeiten</span>
                <button onClick={() => { setEditingMessageId(null); setUserInput(''); }}><X className="w-3 h-3" /></button>
              </div>
            )}
            <form onSubmit={handleSendMessage} className={`flex items-center gap-2 bg-slate-50 dark:bg-slate-800 p-2 rounded-full shadow-inner ${editingMessageId ? 'rounded-t-none' : ''}`}>
              <button type="button" onClick={toggleMic} className={`p-3 rounded-full transition-colors ${isListening ? 'bg-red-500 text-white animate-pulse' : 'text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}>
                <Mic className="w-5 h-5" />
              </button>
              <input 
                value={userInput} 
                onChange={(e) => setUserInput(e.target.value)} 
                placeholder="NoteHub fragen..." 
                className="flex-1 bg-transparent border-none outline-none text-sm px-2 py-2 text-slate-700 dark:text-slate-200" 
              />
              <button 
                type="submit" 
                disabled={isLoading || !userInput.trim()} 
                className={`p-3 rounded-full transition-all ${userInput.trim() ? 'bg-indigo-500 text-white shadow-lg' : 'bg-slate-200 dark:bg-slate-700 text-slate-400 opacity-50'}`}
              >
                {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
              </button>
            </form>
          </div>
        </section>

        {/* Tab Navigation for Mobile */}
        <nav className="fixed bottom-0 inset-x-0 h-16 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t dark:border-slate-800 flex items-center justify-around md:hidden z-50 px-safe pb-safe shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)]">
          <button onClick={() => setActiveTab('plan')} className={`flex-1 flex flex-col items-center gap-1 transition-colors ${activeTab === 'plan' ? 'text-indigo-500' : 'text-slate-400'}`}>
            <ListTodo className="w-6 h-6" />
            <span className="text-[10px] font-black uppercase tracking-widest">Plan</span>
          </button>
          <button onClick={() => setActiveTab('chat')} className={`flex-1 flex flex-col items-center gap-1 transition-colors ${activeTab === 'chat' ? 'text-indigo-500' : 'text-slate-400'}`}>
            <MessageSquare className="w-6 h-6" />
            <span className="text-[10px] font-black uppercase tracking-widest">Chat</span>
          </button>
        </nav>
      </main>

      {/* Notifications and Panels */}
      {activeNotification && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 animate-in fade-in">
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={() => setActiveNotification(null)} />
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-xs rounded-[2.5rem] p-8 text-center shadow-2xl scale-in-center">
            <Bell className="w-12 h-12 text-indigo-500 mx-auto mb-6 animate-bounce" />
            <h3 className="text-xl font-black mb-1">{activeNotification.title}</h3>
            <p className="text-xs text-slate-400 mb-6">Zeit für deine Aufgabe!</p>
            <button onClick={() => setActiveNotification(null)} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg active:scale-95 transition-all">Verstanden</button>
          </div>
        </div>
      )}

      {isPanelOpen !== 'none' && (
        <div className="fixed inset-y-0 right-0 z-[200] w-full max-w-md bg-white dark:bg-slate-900 shadow-2xl p-8 overflow-y-auto animate-in slide-in-from-right duration-300">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-black">{isPanelOpen === 'settings' ? 'Einstellungen' : 'Voice Assistant'}</h2>
            <button onClick={() => setIsPanelOpen('none')} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full"><X className="w-6 h-6" /></button>
          </div>
          
          {isPanelOpen === 'voice' && (
            <div className="py-4">
              <VoiceAssistant 
                tasks={tasks} 
                onAddTask={(t) => setTasks([...tasks, t])} 
                onDeleteTask={(id) => setTasks(tasks.filter(t => t.id !== id))} 
                onUpdateTask={(id, updates) => setTasks(tasks.map(t => t.id === id ? { ...t, ...updates } : t))} 
                onPlayBriefing={handlePlayBriefing} 
                selectedVoice={selectedVoice} 
              />
            </div>
          )}
          
          {isPanelOpen === 'settings' && (
            <div className="space-y-10 pb-12">
              <section className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl"><UserCircle className="w-5 h-5 text-indigo-500" /></div>
                  <h3 className="font-black text-sm uppercase tracking-widest text-slate-400">Dein Profil</h3>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Name</label>
                    <div className="relative flex items-center">
                      <FontType className="absolute left-4 w-4 h-4 text-slate-300" />
                      <input type="text" value={userProfile.name} onChange={(e) => setUserProfile({ ...userProfile, name: e.target.value })} placeholder="Dein Name" className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Geburtsdatum</label>
                    <div className="relative flex items-center">
                      <Calendar className="absolute left-4 w-4 h-4 text-slate-300" />
                      <input type="date" value={userProfile.birthDate} onChange={(e) => setUserProfile({ ...userProfile, birthDate: e.target.value })} className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500/20" />
                    </div>
                  </div>
                </div>
              </section>

              <section className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl"><Volume2 className="w-5 h-5 text-indigo-500" /></div>
                  <h3 className="font-black text-sm uppercase tracking-widest text-slate-400">KI-Stimme</h3>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {VOICES.map((voice) => (
                    <button key={voice.id} onClick={() => setSelectedVoice(voice.id)} className={`flex items-center justify-between p-4 rounded-2xl transition-all border-2 ${selectedVoice === voice.id ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-500/30 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'bg-white dark:bg-slate-900 border-transparent hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-500'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${selectedVoice === voice.id ? 'bg-indigo-500' : 'bg-slate-200'}`} />
                        <span className="text-sm font-black uppercase tracking-tight">{voice.name}</span>
                      </div>
                      <span className="text-[10px] font-bold opacity-60">{voice.label}</span>
                    </button>
                  ))}
                </div>
              </section>

              <section className="space-y-6 pt-4 border-t dark:border-slate-800">
                <button onClick={handleClearChat} className="w-full p-5 bg-red-50 dark:bg-red-900/10 text-red-600 rounded-3xl font-black text-xs uppercase tracking-widest hover:bg-red-100 dark:hover:bg-red-900/20 transition-all active:scale-95 flex items-center justify-center gap-2">
                  <Trash2 className="w-4 h-4" /> Verlauf löschen
                </button>
              </section>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default App;
