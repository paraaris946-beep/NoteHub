
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Task, DayPlan, UserStats, Message, UserProfile } from './types';
import { 
  getGeminiClient,
  startCoachingChat, 
  generateFocusImage, 
  generateBriefingAudio, 
  generateAppLogo,
  decodeBase64, 
  decodeAudioData 
} from './services/geminiService';
import TaskItem from './components/TaskItem';
import VoiceAssistant from './components/VoiceAssistant';
import { 
  Settings, 
  Sparkles,
  LayoutDashboard,
  Send,
  ChevronDown,
  Coffee,
  Volume2,
  Loader2,
  X,
  Clock,
  Moon,
  Sun,
  Mic,
  Plus,
  Eraser,
  Info,
  Headphones,
  Download,
  Search,
  MessageSquare,
  ExternalLink,
  User,
  Calendar,
  IdCard
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

  const [focusImageUrl, setFocusImageUrl] = useState<string | null>(() => {
    return localStorage.getItem('minicoach_focus_img');
  });

  const [userProfile, setUserProfile] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('notehub_profile');
    return saved ? JSON.parse(saved) : { name: '', birthDate: '' };
  });

  const [userInput, setUserInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isBriefingLoading, setIsBriefingLoading] = useState(false);
  const [isLogoLoading, setIsLogoLoading] = useState(false);
  const [appLogoUrl, setAppLogoUrl] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showPlan, setShowPlan] = useState(tasks.length > 0 || !!dayPlan);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState(() => {
    return localStorage.getItem('minicoach_voice') || 'Kore';
  });
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('minicoach_theme');
    return saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches);
  });

  const chatRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);

  // Persistence Sync
  useEffect(() => { localStorage.setItem('minicoach_tasks', JSON.stringify(tasks)); }, [tasks]);
  useEffect(() => { localStorage.setItem('minicoach_dayplan', JSON.stringify(dayPlan)); }, [dayPlan]);
  useEffect(() => { localStorage.setItem('minicoach_messages', JSON.stringify(messages)); }, [messages]);
  useEffect(() => { localStorage.setItem('minicoach_voice', selectedVoice); }, [selectedVoice]);
  useEffect(() => { localStorage.setItem('notehub_profile', JSON.stringify(userProfile)); }, [userProfile]);
  useEffect(() => { 
    if (focusImageUrl) localStorage.setItem('minicoach_focus_img', focusImageUrl);
    else localStorage.removeItem('minicoach_focus_img');
  }, [focusImageUrl]);

  useEffect(() => {
    chatRef.current = startCoachingChat();
    const cachedLogo = localStorage.getItem('minicoach_logo');
    if (cachedLogo) setAppLogoUrl(cachedLogo);
    else handleRegenerateLogo();

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'de-DE';
      
      recognitionRef.current.onresult = (event: any) => {
        const results = event.results;
        for (let i = event.resultIndex; i < results.length; ++i) {
          if (results[i].isFinal) {
            const transcript = results[i][0].transcript;
            setUserInput(prev => (prev.trim() ? prev.trim() + ' ' : '') + transcript.trim());
            setIsListening(false);
          }
        }
      };

      recognitionRef.current.onerror = (e: any) => {
        console.error("Speech Recognition Error:", e);
        setIsListening(false);
      };
      
      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (isDarkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    localStorage.setItem('minicoach_theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleRegenerateLogo = async () => {
    setIsLogoLoading(true);
    try {
      const url = await generateAppLogo();
      if (url) {
        setAppLogoUrl(url);
        localStorage.setItem('minicoach_logo', url);
      }
    } catch (err) { console.error(err); }
    finally { setIsLogoLoading(false); }
  };

  const handleClearChat = () => {
    if (confirm("Nur den Chat-Verlauf leeren? Dein Plan bleibt erhalten.")) {
      setMessages([INITIAL_MESSAGE]);
    }
  };

  const handleExportTasks = () => {
    if (tasks.length === 0) return;
    
    const dateStr = new Date().toLocaleDateString('de-DE');
    let content = `# Mein Tagesplan - ${dateStr} (Exportiert von NoteHub)\n\n`;
    
    if (dayPlan) {
      content += `**Fokus:** ${dayPlan.focus}\n`;
      content += `**Motivation:** ${dayPlan.motivation}\n\n`;
    }
    
    content += `## Aufgaben\n`;
    tasks.forEach(task => {
      const status = task.completed ? '[x]' : '[ ]';
      const importance = task.isImportant ? ' ⭐' : '';
      const time = task.time ? ` (${task.time})` : '';
      content += `${status} ${task.title}${time}${importance} [Prio: ${task.priority}]\n`;
    });
    
    content += `\n---\nExportiert von NoteHub`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Tagesplan_NoteHub_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const toggleListening = () => {
    if (!recognitionRef.current) return alert("Browser unterstützt keine Spracherkennung.");
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) { 
        console.warn("Could not start recognition:", e);
        setIsListening(false);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSendMessage = async () => {
    if ((!userInput.trim() && !selectedImage) || isLoading) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: userInput || (selectedImage ? "Bild analysieren..." : ""),
      timestamp: new Date(),
      image: selectedImage || undefined
    };

    setMessages(prev => [...prev, userMsg]);
    const currentInput = userInput;
    const currentImage = selectedImage;
    setUserInput('');
    setSelectedImage(null);
    setIsLoading(true);

    try {
      let responseText = "";
      const dateContext = `(Heute ist ${new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}, ${new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })})`;
      const profileContext = userProfile.name ? `(Der Nutzer heißt ${userProfile.name})` : '';
      
      if (currentImage) {
        const ai = getGeminiClient();
        const base64Data = currentImage.split(',')[1];
        const result = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: [{
            parts: [
              { inlineData: { data: base64Data, mimeType: 'image/jpeg' } },
              { text: `${dateContext} ${profileContext} ${currentInput || "Analysiere das Bild."} Antworte im NoteHub-Stil mit [PLAN_JSON] falls Aufgaben dabei sind.` }
            ]
          }],
          config: { systemInstruction: "Du bist NoteHub. Extrahiere Aufgaben präzise mit Fokus auf korrekten Datums- und Zeitangaben." }
        });
        responseText = result.text || "";
      } else {
        const result = await chatRef.current.sendMessage({ message: `${dateContext} ${profileContext} ${currentInput}` });
        responseText = result.text;
      }

      // Robust JSON Extraction
      if (responseText.includes('[PLAN_JSON]')) {
        const parts = responseText.split('[PLAN_JSON]');
        const potentialJson = parts[1]?.trim() || "";
        const startIndex = potentialJson.indexOf('{');
        const endIndex = potentialJson.lastIndexOf('}');
        responseText = parts[0].trim();
        
        if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
          try {
            const cleanJson = potentialJson.substring(startIndex, endIndex + 1);
            const planData = JSON.parse(cleanJson);
            setDayPlan(planData);
            setTasks(planData.tasks.map((t: any) => ({ ...t, completed: false, isImportant: t.isImportant || false })));
            setShowPlan(true);
            const img = await generateFocusImage(planData.focus);
            setFocusImageUrl(img);
          } catch (e) { console.error("JSON Parse Error:", e); }
        }
      }

      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'model', text: responseText, timestamp: new Date() }]);
    } catch (err) {
      setMessages(prev => [...prev, { id: 'err', role: 'model', text: 'Ups, da hat was nicht geklappt.', timestamp: new Date() }]);
    } finally { setIsLoading(false); }
  };

  const handlePlayBriefing = async () => {
    if (!dayPlan || isBriefingLoading) return;
    setIsBriefingLoading(true);
    try {
      const base64Audio = await generateBriefingAudio(dayPlan, selectedVoice);
      const ctx = audioContextRef.current || new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = ctx;
      if (ctx.state === 'suspended') await ctx.resume();
      const audioBuffer = await decodeAudioData(decodeBase64(base64Audio), ctx, 24000, 1);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.start(0);
    } catch (err) { console.error(err); alert("Audio-Fehler."); }
    finally { setIsBriefingLoading(false); }
  };

  const addTask = (task: any) => {
    setTasks(prev => [...prev, { ...task, isImportant: task.isImportant || false }]);
    setShowPlan(true);
  };

  const toggleTask = (id: string) => setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  const toggleImportant = (id: string) => setTasks(prev => prev.map(t => t.id === id ? { ...t, isImportant: !t.isImportant } : t));
  const deleteTask = (id: string) => {
    const updated = tasks.filter(t => t.id !== id);
    setTasks(updated);
    if (updated.length === 0 && !dayPlan) setShowPlan(false);
  };
  const updateTask = (id: string, updates: Partial<Task>) => setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));

  const progress = useMemo(() => tasks.length === 0 ? 0 : Math.round((tasks.filter(t => t.completed).length / tasks.length) * 100), [tasks]);
  const processedTasks = useMemo(() => {
    let list = [...tasks];
    if (searchQuery.trim()) list = list.filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()));
    list.sort((a, b) => (b.isImportant ? 1 : 0) - (a.isImportant ? 1 : 0));
    return list;
  }, [tasks, searchQuery]);

  return (
    <div className="min-h-screen bg-[#FDFDFD] dark:bg-slate-950 text-slate-800 dark:text-slate-100 flex flex-col h-screen overflow-hidden transition-colors duration-500">
      <header className="flex-none bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b dark:border-slate-800 px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl overflow-hidden shadow-sm bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            {isLogoLoading ? <Loader2 className="w-5 h-5 text-indigo-400 animate-spin" /> : (appLogoUrl ? <img src={appLogoUrl} className="w-full h-full object-cover" /> : <Coffee className="w-5 h-5 text-slate-400" />)}
          </div>
          <div className="flex flex-col">
            <h1 className="font-bold text-lg leading-none dark:text-white tracking-tight">NoteHub</h1>
            <p className="text-[9px] text-slate-400 uppercase mt-0.5 font-black tracking-widest">Personal Hub</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {tasks.length > 0 && (
            <button onClick={handleExportTasks} className="p-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-2xl transition-all" title="Plan exportieren (.txt)">
              <Download className="w-5 h-5" />
            </button>
          )}

          {dayPlan && (
            <button onClick={handlePlayBriefing} disabled={isBriefingLoading} className={`p-2.5 rounded-2xl transition-all ${isBriefingLoading ? 'bg-indigo-50 dark:bg-slate-800' : 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:scale-105'}`} title="Tages-Briefing abspielen">
              {isBriefingLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Headphones className="w-5 h-5" />}
            </button>
          )}

          <button onClick={() => setIsDarkMode(!isDarkMode)} className="p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl text-slate-400" title="Dark Mode umschalten">
            {isDarkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          
          <button onClick={handleClearChat} className="p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl text-slate-400" title="Chat-Historie leeren">
            <Eraser className="w-5 h-5" />
          </button>

          {!showPlan && tasks.length > 0 && (
            <button onClick={() => setShowPlan(true)} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-2xl text-xs font-bold shadow-lg shadow-indigo-200 dark:shadow-none hover:scale-105 transition-all">
              <LayoutDashboard className="w-4 h-4" /> Plan
            </button>
          )}

          <button onClick={() => setIsSettingsOpen(true)} className="p-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-2xl" title="Einstellungen">
            <Settings className="w-5 h-5 text-slate-300 dark:text-slate-600" />
          </button>
        </div>
      </header>

      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-6">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[2.5rem] shadow-2xl border dark:border-slate-800 overflow-hidden">
            <div className="px-8 py-6 flex items-center justify-between border-b dark:border-slate-800">
              <h2 className="text-xl font-bold dark:text-white">Einstellungen</h2>
              <button onClick={() => setIsSettingsOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"><X className="w-6 h-6 text-slate-400" /></button>
            </div>
            <div className="p-8 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">
               <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-3xl space-y-4">
                  <div className="flex items-start gap-3">
                    <Info className="w-5 h-5 text-indigo-500 mt-0.5 shrink-0" />
                    <div>
                      <h3 className="text-sm font-bold dark:text-slate-100">Über NoteHub</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mt-1">
                        Dein intelligenter Begleiter für einen strukturierten Alltag. Alle Daten werden lokal auf deinem Gerät gespeichert.
                      </p>
                    </div>
                  </div>
               </div>

               {/* Profile Section */}
               <div className="space-y-4">
                 <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Profil (Zukünftige Features)</h3>
                 <div className="bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 p-5 space-y-5">
                    <div className="space-y-2">
                       <label className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">
                         <IdCard className="w-3.5 h-3.5" /> Name
                       </label>
                       <input 
                         type="text" 
                         value={userProfile.name}
                         onChange={(e) => setUserProfile(prev => ({ ...prev, name: e.target.value }))}
                         placeholder="Dein Name"
                         className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-indigo-500/20 rounded-xl text-sm outline-none transition-all dark:text-slate-200"
                       />
                    </div>
                    <div className="space-y-2">
                       <label className="flex items-center gap-2 text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-1">
                         <Calendar className="w-3.5 h-3.5" /> Geburtsdatum
                       </label>
                       <input 
                         type="date" 
                         value={userProfile.birthDate}
                         onChange={(e) => setUserProfile(prev => ({ ...prev, birthDate: e.target.value }))}
                         className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-900 border-2 border-transparent focus:border-indigo-500/20 rounded-xl text-sm outline-none transition-all dark:text-slate-200"
                       />
                    </div>
                 </div>
               </div>

               <div className="space-y-4">
                 <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Stimme & Audio</h3>
                 <div className="bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 p-5 space-y-4">
                    <div className="flex items-center gap-3 mb-2">
                       <Volume2 className="w-5 h-5 text-indigo-500 shrink-0" />
                       <h3 className="text-sm font-bold dark:text-slate-100">Wähle deine Begleitung</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {VOICES.map(voice => (
                        <button key={voice.id} onClick={() => setSelectedVoice(voice.id)} className={`flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all ${selectedVoice === voice.id ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'border-slate-100 dark:border-slate-800 text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                          <User className={`w-5 h-5 mb-1 ${selectedVoice === voice.id ? 'opacity-100' : 'opacity-40'}`} />
                          <span className="text-[11px] font-bold truncate w-full text-center">{voice.name}</span>
                          <span className="text-[9px] opacity-60 truncate w-full text-center">{voice.label}</span>
                        </button>
                      ))}
                    </div>
                 </div>

                 <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mt-6">Design & Feedback</h3>
                 <div className="flex items-center justify-between px-4 py-4 bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700">
                   <span className="text-sm font-medium dark:text-slate-200">Dunkler Modus</span>
                   <button onClick={() => setIsDarkMode(!isDarkMode)} className={`w-12 h-6 rounded-full transition-colors relative ${isDarkMode ? 'bg-indigo-600' : 'bg-slate-200'}`}>
                     <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${isDarkMode ? 'translate-x-6' : ''}`} />
                   </button>
                 </div>

                 <div className="bg-white dark:bg-slate-800 rounded-2xl border dark:border-slate-700 p-4 space-y-4">
                    <div className="flex items-start gap-3 mb-2">
                       <MessageSquare className="w-5 h-5 text-indigo-500 shrink-0 mt-1" />
                       <div>
                         <h3 className="text-sm font-bold dark:text-slate-100">Dein Feedback</h3>
                         <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">Hilf uns, NoteHub noch besser zu machen!</p>
                       </div>
                    </div>
                    <button onClick={() => window.open('https://forms.gle/feedback-minicoach', '_blank')} className="w-full flex items-center justify-center gap-2 bg-indigo-600 dark:bg-indigo-500 hover:brightness-95 text-white py-3.5 rounded-xl font-bold text-sm transition-all group shadow-md">
                      Feedback geben
                      <ExternalLink className="w-4 h-4 opacity-70 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </button>
                 </div>
               </div>
            </div>
            <div className="px-8 py-6 bg-slate-50 dark:bg-slate-800/50 border-t dark:border-slate-800">
              <button onClick={() => setIsSettingsOpen(false)} className="w-full bg-slate-800 dark:bg-indigo-600 text-white py-4 rounded-2xl font-bold shadow-lg transition-transform active:scale-[0.98]">Schließen</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        <div className={`flex-1 flex flex-col h-full bg-[#FDFDFD] dark:bg-slate-950 transition-all ${showPlan ? 'md:w-3/5' : 'w-full'}`}>
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2`}>
                <div className="flex flex-col gap-1 max-w-[85%]">
                  <div className={`p-4 rounded-[2rem] shadow-sm text-sm leading-relaxed ${msg.role === 'user' ? 'bg-slate-800 dark:bg-indigo-600 text-white rounded-tr-none shadow-indigo-100 dark:shadow-none' : 'bg-white dark:bg-slate-900 border dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-tl-none shadow-slate-100 dark:shadow-none'}`}>
                    {msg.image && <img src={msg.image} className="max-w-full rounded-2xl mb-3 border dark:border-slate-700" alt="Anhang" />}
                    {msg.text}
                  </div>
                  <span className="text-[9px] text-slate-300 font-bold px-2 uppercase tracking-tighter">{msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-slate-900 border dark:border-slate-800 p-4 rounded-3xl flex items-center gap-3"><Loader2 className="w-4 h-4 animate-spin text-indigo-400" /> <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Verarbeite...</span></div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-6 bg-white dark:bg-slate-900/50 border-t dark:border-slate-800">
            <div className="max-w-3xl mx-auto flex flex-col gap-3">
              {selectedImage && (
                <div className="relative self-start">
                  <img src={selectedImage} className="w-24 h-24 object-cover rounded-2xl border-4 border-white dark:border-slate-800 shadow-xl" />
                  <button onClick={() => setSelectedImage(null)} className="absolute -top-3 -right-3 bg-red-500 text-white rounded-full p-2 shadow-lg"><X className="w-4 h-4" /></button>
                </div>
              )}
              <div className="flex items-center gap-2">
                <div className={`flex-1 relative flex items-center bg-slate-50 dark:bg-slate-800 rounded-[2rem] border-2 transition-all ${isListening ? 'border-indigo-500 ring-4 ring-indigo-500/10' : 'border-transparent'}`}>
                  <button onClick={() => fileInputRef.current?.click()} className="ml-2 p-3 text-slate-400 hover:text-indigo-600 transition-colors">
                    <Plus className="w-6 h-6" />
                  </button>
                  <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                  <input value={userInput} onChange={(e) => setUserInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()} placeholder={isListening ? "Höre zu..." : "Frag NoteHub etwas oder schick ein Foto..."} className="flex-1 bg-transparent border-none px-4 py-4 text-sm focus:outline-none dark:text-white" disabled={isLoading} />
                  <button onClick={toggleListening} className={`mr-2 p-3 rounded-2xl transition-all ${isListening ? 'bg-indigo-600 text-white shadow-lg animate-pulse' : 'text-slate-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-700'}`} title="Spracherkennung starten">
                    <Mic className="w-6 h-6" />
                  </button>
                </div>
                <button onClick={handleSendMessage} disabled={(!userInput.trim() && !selectedImage) || isLoading} className="bg-slate-800 dark:bg-indigo-600 text-white p-4 rounded-[1.5rem] hover:scale-105 active:scale-[0.98] transition-all shadow-lg shadow-indigo-200 dark:shadow-none disabled:opacity-30">
                  <Send className="w-6 h-6" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className={`fixed md:relative inset-y-0 right-0 w-full md:w-2/5 bg-slate-50/90 dark:bg-slate-900/95 backdrop-blur-xl border-l dark:border-slate-800 z-20 transition-transform transform ${showPlan ? 'translate-x-0' : 'translate-x-full md:translate-x-0 md:opacity-0 md:pointer-events-none'}`}>
          <div className="h-full flex flex-col overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between p-4 md:hidden">
               <button onClick={() => setShowPlan(false)} className="p-2 text-slate-300 hover:text-slate-500"><ChevronDown className="w-6 h-6" /></button>
            </div>
            {tasks.length > 0 || !!dayPlan ? (
              <div className="p-8 space-y-8 pb-32">
                <div className="relative h-56 rounded-[3rem] overflow-hidden shadow-2xl group">
                  {focusImageUrl ? <img src={focusImageUrl} className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110" /> : <div className="w-full h-full bg-slate-200 dark:bg-slate-800 animate-pulse" />}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent p-8 flex flex-col justify-end">
                    <span className="text-[10px] text-white/80 font-black uppercase tracking-widest mb-2">Tages-Fokus</span>
                    <h2 className="text-white font-bold text-3xl tracking-tight leading-tight">{dayPlan?.focus || 'Dein Tag'}</h2>
                    {dayPlan && (
                      <button onClick={handlePlayBriefing} disabled={isBriefingLoading} className="mt-4 flex items-center gap-3 bg-white text-slate-900 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-wider shadow-xl hover:scale-105 transition-all active:scale-95">
                        {isBriefingLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
                        Briefing abspielen
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-2"><LayoutDashboard className="w-4 h-4 text-indigo-500" /><h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dein Ablauf</h3></div>
                    <span className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 bg-white dark:bg-slate-800 px-3 py-1 rounded-full border dark:border-slate-800 shadow-sm">{progress}% Done</span>
                  </div>

                  <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                    <input type="text" placeholder="Aufgaben durchsuchen..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-11 pr-10 py-3.5 bg-white dark:bg-slate-900 border-2 border-transparent focus:border-indigo-500/20 rounded-2xl text-sm outline-none transition-all shadow-sm dark:text-slate-200" />
                    {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 dark:hover:text-slate-100 transition-colors"><X className="w-4 h-4" /></button>}
                  </div>

                  <div className="space-y-4">
                    {processedTasks.length > 0 ? (
                      processedTasks.map(task => (
                        <TaskItem key={task.id} task={task} onToggle={toggleTask} onToggleImportant={toggleImportant} onDelete={deleteTask} onUpdate={updateTask} />
                      ))
                    ) : (
                      <div className="py-12 text-center animate-in fade-in">
                        <div className="inline-flex p-4 bg-slate-100 dark:bg-slate-800 rounded-full mb-3 text-slate-400"><Search className="w-6 h-6" /></div>
                        <p className="text-sm text-slate-400">Keine Aufgaben für "{searchQuery}" gefunden.</p>
                      </div>
                    )}
                  </div>
                </div>
                <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border dark:border-slate-800 shadow-sm">
                  <VoiceAssistant tasks={tasks} onAddTask={addTask} onDeleteTask={deleteTask} onUpdateTask={updateTask} onPlayBriefing={handlePlayBriefing} selectedVoice={selectedVoice} />
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-12 text-center animate-in fade-in">
                <div className="w-24 h-24 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
                  <LayoutDashboard className="w-10 h-10 text-slate-300 dark:text-slate-600" />
                </div>
                <h3 className="font-bold text-xl dark:text-slate-200">Bereit für den Tag?</h3>
                <p className="text-sm text-slate-400 mt-2 mb-10 max-w-[200px]">NoteHub hilft dir. Erzähl mir was ansteht oder schick ein Foto!</p>
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
