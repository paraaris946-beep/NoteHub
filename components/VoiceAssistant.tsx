
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { getGeminiClient, encodeBase64, decodeBase64, decodeAudioData } from '../services/geminiService';
import { Mic, MicOff, Volume2, Sparkles, Loader2, X, MessageSquare, Headphones, AlertCircle, RefreshCcw } from 'lucide-react';
import { Modality, Type, FunctionDeclaration } from '@google/genai';
import { Task } from '../types';

interface VoiceAssistantProps {
  tasks: Task[];
  onAddTask: (task: any) => void;
  onDeleteTask: (id: string) => void;
  onUpdateTask: (id: string, updates: any) => void;
  onPlayBriefing: () => Promise<void>;
  selectedVoice?: string;
}

const VoiceAssistant: React.FC<VoiceAssistantProps> = ({ 
  tasks, 
  onAddTask, 
  onDeleteTask, 
  onUpdateTask, 
  onPlayBriefing,
  selectedVoice = 'Kore'
}) => {
  const [isActive, setIsActive] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<{ message: string; type: 'mic' | 'connection' | 'api' | 'generic' } | null>(null);
  const [transcription, setTranscription] = useState('');
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const stopSession = useCallback((errorOccurred: boolean = false) => {
    if (sessionRef.current) {
      try { sessionRef.current.close?.(); } catch (e) {}
      sessionRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close().catch(() => {});
      inputAudioContextRef.current = null;
    }
    if (audioContextRef.current) {
      for (const source of sourcesRef.current) {
        try { source.stop(); } catch(e) {}
      }
      sourcesRef.current.clear();
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    
    setIsActive(false);
    setIsConnecting(false);
    if (!errorOccurred) {
      setError(null);
    }
    setTranscription('');
  }, []);

  const startSession = async () => {
    setIsConnecting(true);
    setError(null);
    setTranscription('');
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: 16000
        } 
      }).catch(err => {
        throw { type: 'mic', message: 'Mikrofon-Zugriff verweigert. Bitte prüfe deine Browsereinstellungen.' };
      });

      streamRef.current = stream;

      const inCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      inputAudioContextRef.current = inCtx;
      audioContextRef.current = outCtx;

      const tools: FunctionDeclaration[] = [
        {
          name: 'addTask',
          description: 'Fügt eine neue Aufgabe hinzu.',
          parameters: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              time: { type: Type.STRING },
              priority: { type: Type.STRING, enum: ['low', 'medium', 'high'] },
            },
            required: ['title'],
          },
        },
        {
          name: 'playBriefing',
          description: 'Spielt das tägliche Briefing ab.',
          parameters: { type: Type.OBJECT, properties: {} },
        }
      ];

      const ai = getGeminiClient();
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            setIsActive(true);
            setIsConnecting(false);
            setError(null);
            
            const source = inCtx.createMediaStreamSource(stream);
            const scriptProcessor = inCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              if (!isActive && !isConnecting) return;
              const inputData = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) { int16[i] = inputData[i] * 32768; }
              const pcmBlob = { 
                data: encodeBase64(new Uint8Array(int16.buffer)), 
                mimeType: 'audio/pcm;rate=16000' 
              };
              sessionPromise.then(s => {
                if (s) s.sendRealtimeInput({ media: pcmBlob });
              }).catch(() => {});
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inCtx.destination);
          },
          onmessage: async (msg) => {
            if (msg.serverContent?.inputTranscription) {
              setTranscription(msg.serverContent.inputTranscription.text);
            }
            if (msg.serverContent?.interrupted) {
              for (const s of sourcesRef.current) try { s.stop(); } catch(e) {}
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
            if (msg.toolCall) {
              for (const fc of msg.toolCall.functionCalls) {
                try {
                  if (fc.name === 'addTask') onAddTask({ id: Math.random().toString(36).substr(2, 9), title: fc.args.title, time: fc.args.time, priority: fc.args.priority || 'medium', completed: false });
                  if (fc.name === 'playBriefing') onPlayBriefing();
                  sessionPromise.then(s => s.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: { result: "ok" } } }));
                } catch (e) {
                  console.error("Tool execution error:", e);
                }
              }
            }
            const audio = msg.serverContent?.modelTurn?.parts?.find(p => p.inlineData)?.inlineData?.data;
            if (audio && outCtx) {
              try {
                const buf = await decodeAudioData(decodeBase64(audio), outCtx, 24000, 1);
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outCtx.currentTime);
                const source = outCtx.createBufferSource();
                source.buffer = buf;
                source.connect(outCtx.destination);
                source.onended = () => sourcesRef.current.delete(source);
                sourcesRef.current.add(source);
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += buf.duration;
              } catch (e) {
                console.error("Audio decoding error:", e);
              }
            }
          },
          onerror: (e) => { 
            console.error("Live Session Error:", e);
            setError({ type: 'api', message: 'Verbindung zum KI-Server unterbrochen. Bitte versuche es erneut.' });
            stopSession(true); 
          },
          onclose: () => {
            if (isActive) {
              stopSession();
            }
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          tools: [{ functionDeclarations: tools }],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice } } },
          systemInstruction: `Du bist NoteHub Voice. Antworte extrem kurz. Nutze addTask sofort, wenn der Nutzer eine Aufgabe diktiert.`,
          inputAudioTranscription: {},
        },
      });
      sessionRef.current = await sessionPromise;
    } catch (err: any) {
      console.error("Session Start Error:", err);
      setError({ 
        type: err.type || 'generic', 
        message: err.message || 'Ein unerwarteter Fehler ist aufgetreten. Bitte versuche es erneut.' 
      });
      stopSession(true);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* Error Banner */}
      {error && (
        <div className="w-full p-4 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900/50 rounded-2xl flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-red-700 dark:text-red-400">Hoppla!</p>
            <p className="text-[11px] text-red-600 dark:text-red-400/80 leading-snug mt-0.5">{error.message}</p>
            <button 
              onClick={startSession} 
              className="mt-2 text-[10px] font-black uppercase tracking-widest text-red-700 dark:text-red-400 flex items-center gap-1.5 hover:underline"
            >
              <RefreshCcw className="w-3 h-3" /> Erneut versuchen
            </button>
          </div>
          <button onClick={() => setError(null)} className="p-1 text-red-300 hover:text-red-500 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Live Transcription */}
      {isActive && (
        <div className="w-full p-4 bg-indigo-50/50 dark:bg-indigo-900/20 backdrop-blur-md rounded-2xl border border-indigo-100 dark:border-indigo-800/50 animate-in fade-in slide-in-from-bottom-2">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse" />
            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Live Transkription</p>
          </div>
          <p className="text-xs dark:text-slate-200 italic leading-relaxed">
            "{transcription || 'Ich höre dir zu...'}"
          </p>
        </div>
      )}

      <div className="relative group">
        {/* Pulsing effect when active */}
        {isActive && (
          <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-20 scale-125" />
        )}
        
        <button 
          onClick={isActive ? () => stopSession() : startSession} 
          disabled={isConnecting} 
          className={`
            relative z-10 w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-xl active:scale-90
            ${isActive 
              ? 'bg-red-500 shadow-red-500/30 text-white' 
              : 'bg-indigo-600 shadow-indigo-600/30 text-white hover:bg-indigo-700'
            }
            ${isConnecting ? 'opacity-50 cursor-not-allowed' : ''}
          `}
        >
          {isConnecting ? (
            <Loader2 className="w-7 h-7 animate-spin" />
          ) : isActive ? (
            <X className="w-7 h-7" />
          ) : (
            <Mic className="w-7 h-7" />
          )}
        </button>
      </div>

      <div className="text-center space-y-1">
        <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 uppercase tracking-tight">
          {isActive ? 'Assistent Aktiv' : isConnecting ? 'Verbinde...' : 'NoteHub Voice'}
        </h3>
        <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium">
          {isActive ? 'Tippe zum Beenden' : 'Klicke zum Diktieren'}
        </p>
      </div>
    </div>
  );
};

export default VoiceAssistant;
