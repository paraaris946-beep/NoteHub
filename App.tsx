
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
  Play
} from 'lucide-react';

const INITIAL_MESSAGE: Message = { 
  id: '1', 
  role: 'model', 
  text: 'Moin. Ich bin NoteHub. Was steht heute bei dir an? Lass uns schauen, dass es ein entspannter Tag wird.', 
  timestamp: new Date() 
};

const VOICES = [
  { id: 'Kore', name: 'Kore', label: 'Standard (Männlich)' },
  { id: 'Puck', name: 'Puck', label: 'Freundlich (Weiblich)' },
  { id: 'Zephyr', name: 'Zephyr', label: 'Ruhig (Neutral)' },
  { id: 'Charon', name: 'Charon', label: 'Tief (Männlich)' },
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
            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">NoteHub analysiert...</span>
          </div>
          <div className="flex gap-1">
            {[1, 2, 3].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: `${i * 0.1}s` }} />)}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 p-3 rounded-2xl border border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-900/20">
            <User className="w-3.5 h-3.5 text-indigo-500" />
            <span className="text-[11px] font-bold truncate dark:text-slate-200">Kontext: {profile.name || "Aktiv"}</span>
          </div>
          <div className="flex items-center gap-2 p-3 rounded-2xl border border-indigo-500/30 bg-indigo-50/50 dark:bg-indigo-900/20">
            <LayoutDashboard className="w-3.5 h-3.5 text-indigo-500" />
            <span className="text-[11px] font-bold truncate dark:text-slate-200">{tasksCount} Erinnerungen</span>
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
  const [focusImageUrl, setFocusImageUrl] = useState<string | null>(() => localStorage.getItem('minicoach_focus_img'));
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
  const [showPlan, setShowPlan] = useState(tasks.length > 0 || !!dayPlan);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState(() => localStorage.getItem('minicoach_voice') || 'Kore');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('minicoach_theme');
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });
  const [currentlyPlayingId, setCurrentlyPlayingId] = useState<string | null>(null);
  
  const [activeNotification, setActiveNotification] = useState<Task | null>(null);
  const triggeredRemindersRef = useRef<Set<string>>(new Set());
  const tasksRef = useRef<Task[]>(tasks);

  useEffect(() => { tasksRef.current = tasks; }, [tasks]);

  const chatRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { localStorage.setItem('minicoach_tasks', JSON.stringify(tasks)); }, [tasks]);
  useEffect(() => { localStorage.setItem('minicoach_dayplan', JSON.stringify(dayPlan)); }, [dayPlan]);
  useEffect(() => { localStorage.setItem('minicoach_messages', JSON.stringify(messages)); }, [messages]);
  useEffect(() => { localStorage.setItem('minicoach_voice', selectedVoice); }, [selectedVoice]);
  useEffect(() => { localStorage.setItem('notehub_profile', JSON.stringify(userProfile)); }, [userProfile]);
  useEffect(() => { localStorage.setItem('notehub_stats', JSON.stringify(userStats)); }, [userStats]);
  useEffect(() => { if (focusImageUrl) localStorage.setItem('minicoach_focus_img', focusImageUrl); }, [focusImageUrl]);

  useEffect(() => {
    chatRef.current = startCoachingChat();
    const cachedLogo = localStorage.getItem('minicoach_logo');
    if (cachedLogo) setAppLogoUrl(cachedLogo);
    else handleRegenerateLogo();

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
      const url = await generateAppLogo();
      if (url) { setAppLogoUrl(url); localStorage.setItem('minicoach_logo', url); }
    } catch (err) { console.error(err); }
    finally { setIsLogoLoading(false); }
  };

  const handleSendMessage = async () => {
    if ((!userInput.trim() && !selectedImage) || isLoading) return;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: userInput || "Foto analysieren...", timestamp: new Date(), image: selectedImage || undefined };
    setMessages(prev => [...prev, userMsg]);
    const currentInput = userInput;
    const currentImage = selectedImage;
    setUserInput('');
    setSelectedImage(null);
    setIsLoading(true);

    try {
      const modelId = Date.now().toString();
      setMessages(prev => [...prev, { id: modelId, role: 'model', text: "", timestamp: new Date() }]);
      let responseText = "";

      if (currentImage) {
        const ai = getGeminiClient();
        const base64Data = currentImage.split(',')[1];
        const result = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: [{ parts: [{ inlineData: { data: base64Data, mimeType: 'image/jpeg' } }, { text: `${currentInput || "Analysiere das Bild."}` }] }],
        });
        responseText = result.text || "";
        updateStreamingMessage(modelId, responseText);
      } else {
        const stream = await chatRef.current.sendMessageStream({ message: currentInput });
        for await (const chunk of stream) { responseText += chunk.text; updateStreamingMessage(modelId, responseText); }
      }

      if (responseText.includes('[PLAN_JSON]')) {
        const parts = responseText.split('[PLAN_JSON]');
        const potentialJson = parts[1]?.trim() || "";
        const startIndex = potentialJson.indexOf('{');
        const endIndex = potentialJson.lastIndexOf('}');
        if (startIndex !== -1 && endIndex !== -1) {
          const cleanJson = potentialJson.substring(startIndex, endIndex + 1);
          const planData = JSON.parse(cleanJson);
          setDayPlan(planData);
          setTasks(planData.tasks.map((t: any) => ({ ...t, completed: false })));
          setShowPlan(true);
          updateStreamingMessage(modelId, parts[0].trim());
          const img = await generateFocusImage(planData.focus);
          setFocusImageUrl(img);
        }
      }
    } catch (err) { console.error(err); updateStreamingMessage(Date.now().toString(), "Entschuldige, da gab es ein Problem mit der Verbindung."); }
    finally { setIsLoading(false); }
  };

  const updateStreamingMessage = (id: string, text: string) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, text } : m));
  };

  const speakMessage = async (msg: Message) => {
    if (currentlyPlayingId === msg.id) return;
    setCurrentlyPlayingId(msg.id);
    try {
      const base64Audio = await generateMessageAudio(msg.text, selectedVoice);
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      if (ctx.state === 'suspended') await ctx.resume();
      const audioBuffer = await decodeAudioData(decodeBase64(base64Audio), ctx, 24000, 1);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.onended = () => setCurrentlyPlayingId(null);
      source.start(0);
    } catch (err) { console.error(err); setCurrentlyPlayingId(null); }
  };

  const handlePlayBriefing = async () => {
    if (tasks.length === 0 || isBriefingLoading) return;
    setIsBriefingLoading(true);
    try {
      const base64Audio = await generateBriefingAudio(tasks, dayPlan?.focus, dayPlan?.motivation, selectedVoice);
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      if (ctx.state === 'suspended') await ctx.resume();
      const audioBuffer = await decodeAudioData(decodeBase64(base64Audio), ctx, 24000, 1);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.start(0);
    } catch (err) { console.error(err); alert("Audio-Fehler: " + err); }
    finally { setIsBriefingLoading(false); }
  };

  const handleUpdateMood = (mood: string) => {
    setUserStats(prev => ({ ...prev, mood }));
  };

  const addTask = (task: any) => { setTasks(prev => [...prev, task]); setShowPlan(true); };
  const toggleTask = (id: string) => setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  const toggleImportant = (id: string) => setTasks(prev => prev.map(t => t.id === id ? { ...t, isImportant: !t.isImportant } : t));
  const deleteTask = (id: string) => setTasks(prev => prev.filter(t => t.id !== id));
  const updateTask = (id: string, updates: Partial<Task>) => setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));

  const progress = useMemo(() => tasks.length === 0 ? 0 : Math.round((tasks.filter(t => t.completed).length / tasks.length) * 100), [tasks]);

  return (
    <div className={`min-h-screen bg-[#FDFDFD] dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col h-screen overflow-hidden transition-all duration-700 ${activeNotification ? 'ring-[12px] ring-inset ring-indigo-500/50' : ''}`}>
      
      {activeNotification && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xl" onClick={() => setActiveNotification(null)} />
          <div className="absolute inset-0 bg-indigo-500/10 animate-pulse pointer-events-none" />
          <div className="relative bg-white dark:bg-slate-900 w-full max-w-sm rounded-[3rem] p-10 shadow-[0_0_100px_rgba(99,102,241,0.3)] border-2 border-indigo-500/30 text-center animate-in zoom-in-95 duration-500 flex flex-col items-center">
            <div className="w-24 h-24 bg-indigo-50 dark:bg-indigo-900/30 rounded-[2rem] flex items-center justify-center mb-8 relative">
              <div className="absolute inset-0 bg-indigo-500/20 rounded-[2rem] animate-ping" />
              <Bell className="w-10 h-10 text-indigo-500 fill-indigo-500" />
            </div>
            <h2 className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-3">Erinnerungssignal</h2>
            <h3 className="text-2xl font-black text-slate-800 dark:text-white mb-4 leading-tight">{activeNotification.title}</h3>
            <p className="text-sm text-slate-400 dark:text-slate-500 mb-10 px-4">Es ist {activeNotification.reminderAt} Uhr. Zeit für deine Aufgabe.</p>
            <div className="flex flex-col w-full gap-3">
              <button onClick={() => { toggleTask(activeNotification.id); setActiveNotification(null); }} className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-200 dark:shadow-none hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center gap-2">
                <Check className="w-5 h-5" /> Erledigt
              </button>
              <button onClick={() => setActiveNotification(null)} className="w-full py-5 text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-colors">Später</button>
            </div>
          </div>
        </div>
      )}

      <header className="flex-none bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b dark:border-slate-800 px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl overflow-hidden shadow-sm bg-slate-100 flex items-center justify-center">
            {isLogoLoading ? <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" /> : (appLogoUrl ? <img src={appLogoUrl} className="w-full h-full object-cover" /> : <Coffee className="w-5 h-5 text-slate-400" />)}
          </div>
          <h1 className="font-bold text-lg dark:text-white">NoteHub</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handlePlayBriefing} disabled={isBriefingLoading} className={`p-2.5 rounded-2xl ${isBriefingLoading ? 'bg-indigo-50 animate-pulse' : 'text-indigo-600'}`} title="Briefing abspielen"><Volume2 className="w-5 h-5" /></button>
          <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2.5 rounded-2xl text-slate-400">{isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}</button>
          <button onClick={() => setIsSettingsOpen(true)} className="p-2.5 rounded-2xl"><Settings className="w-5 h-5 text-slate-300" /></button>
        </div>
      </header>

      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] p-8 space-y-8 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold dark:text-white">Einstellungen</h2>
              <button onClick={() => setIsSettingsOpen(false)}><X className="w-6 h-6 text-slate-400" /></button>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase">Nutzername</label>
                <input type="text" value={userProfile.name} onChange={(e) => setUserProfile(p => ({ ...p, name: e.target.value }))} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 rounded-xl" placeholder="Dein Name" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase">Stimme</label>
                <div className="grid grid-cols-2 gap-2">
                  {VOICES.map(v => (
                    <button key={v.id} onClick={() => setSelectedVoice(v.id)} className={`p-3 rounded-xl border-2 transition-all ${selectedVoice === v.id ? 'border-indigo-500 bg-indigo-50 text-indigo-600' : 'border-slate-100 dark:border-slate-800 text-slate-400'}`}>{v.name}</button>
                  ))}
                </div>
              </div>
            </div>
            <button onClick={() => setIsSettingsOpen(false)} className="w-full bg-slate-800 dark:bg-indigo-600 text-white py-4 rounded-2xl font-bold shadow-lg">Speichern</button>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className={`flex-1 flex flex-col h-full bg-[#FDFDFD] dark:bg-slate-950 transition-all ${showPlan ? 'md:w-3/5' : 'w-full'}`}>
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300`}>
                <div className="flex flex-col gap-1 max-w-[85%] group">
                  <div className={`relative p-5 rounded-[2.2rem] text-sm leading-relaxed ${msg.role === 'user' ? 'bg-slate-800 text-white rounded-tr-none shadow-md' : 'bg-white dark:bg-slate-900 border dark:border-slate-800 rounded-tl-none text-slate-700 dark:text-slate-200 shadow-sm'}`}>
                    {msg.image && <img src={msg.image} className="max-w-full rounded-2xl mb-4" />}
                    <div className="whitespace-pre-wrap">{msg.text || (isLoading && msg.id === messages[messages.length-1].id ? 'NoteHub schreibt...' : '')}</div>
                    
                    {msg.role === 'model' && msg.text && (
                      <button 
                        onClick={() => speakMessage(msg)}
                        className={`absolute -right-12 top-2 p-3 bg-white dark:bg-slate-800 rounded-2xl shadow-sm border dark:border-slate-700 transition-all hover:scale-110 active:scale-90 ${currentlyPlayingId === msg.id ? 'text-indigo-500 animate-pulse' : 'text-slate-300'}`}
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          <div className="p-6 bg-white dark:bg-slate-900/50 border-t dark:border-slate-800 relative">
            <ThoughtVisualizer active={isLoading} profile={userProfile} tasksCount={tasks.length} />
            <div className="max-w-3xl mx-auto flex items-center gap-2">
              <div className="flex-1 flex items-center bg-slate-50 dark:bg-slate-800 rounded-[2rem] border-2 border-transparent focus-within:border-indigo-500/20 transition-all">
                <button onClick={() => fileInputRef.current?.click()} className="p-4 text-slate-400 hover:text-indigo-500 transition-colors"><Plus className="w-6 h-6" /></button>
                <input type="file" ref={fileInputRef} onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) { const r = new FileReader(); r.onload = () => setSelectedImage(r.result as string); r.readAsDataURL(f); }
                }} className="hidden" />
                <input value={userInput} onChange={(e) => setUserInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()} placeholder="Schreib NoteHub..." className="flex-1 bg-transparent px-4 py-5 text-sm outline-none dark:text-white" disabled={isLoading} />
              </div>
              <button onClick={handleSendMessage} disabled={isLoading} className={`bg-slate-800 dark:bg-indigo-600 text-white p-5 rounded-[1.5rem] shadow-lg transition-all active:scale-90 ${isLoading ? 'opacity-50' : 'hover:shadow-indigo-500/20'}`}><Send className="w-6 h-6" /></button>
            </div>
          </div>
        </div>
        
        <div className={`fixed md:relative inset-y-0 right-0 w-full md:w-2/5 bg-slate-50/90 dark:bg-slate-900/95 backdrop-blur-xl border-l dark:border-slate-800 z-20 transition-transform transform ${showPlan ? 'translate-x-0' : 'translate-x-full md:translate-x-0 md:opacity-0 md:pointer-events-none'}`}>
          <div className="h-full flex flex-col overflow-y-auto custom-scrollbar p-8 space-y-8">
            <MoodTracker currentMood={userStats.mood} onMoodSelect={handleUpdateMood} />
            {tasks.length > 0 || !!dayPlan ? (
              <>
                <div className="relative h-56 rounded-[3rem] overflow-hidden shadow-2xl">
                  {focusImageUrl ? <img src={focusImageUrl} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-slate-200 dark:bg-slate-800 animate-pulse" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent p-8 flex flex-col justify-end">
                    <h2 className="text-white font-bold text-2xl tracking-tight">{dayPlan?.focus || 'Fokus des Tages'}</h2>
                    <button onClick={handlePlayBriefing} disabled={isBriefingLoading} className="mt-4 flex items-center gap-2 bg-white text-slate-900 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl">
                      {isBriefingLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />} Briefing
                    </button>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-2">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Aufgaben ({progress}%)</h3>
                    <button onClick={() => setShowPlan(false)} className="md:hidden p-2 text-slate-400"><ChevronDown className="w-6 h-6" /></button>
                  </div>
                  <div className="space-y-3">
                    {tasks.map(task => <TaskItem key={task.id} task={task} onToggle={toggleTask} onToggleImportant={toggleImportant} onDelete={deleteTask} onUpdate={updateTask} />)}
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border dark:border-slate-800 shadow-sm">
                  <VoiceAssistant tasks={tasks} onAddTask={addTask} onDeleteTask={deleteTask} onUpdateTask={updateTask} onPlayBriefing={handlePlayBriefing} selectedVoice={selectedVoice} />
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-[2rem] flex items-center justify-center mb-6">
                  <Brain className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="font-bold dark:text-slate-200 text-lg">Womit starten wir?</h3>
                <p className="text-xs text-slate-400 mt-2 mb-10 leading-relaxed px-6">Lass uns einen Plan schmieden oder frag mich nach Empfehlungen für einen produktiven Tag.</p>
                <div className="w-full p-8 bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-[3rem] shadow-sm">
                  <VoiceAssistant tasks={tasks} onAddTask={addTask} onDeleteTask={deleteTask} onUpdateTask={updateTask} onPlayBriefing={handlePlayBriefing} selectedVoice={selectedVoice} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
