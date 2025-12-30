
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { getGeminiClient, encodeBase64, decodeBase64, decodeAudioData } from '../services/geminiService';
import { Mic, MicOff, Volume2, Sparkles, Loader2, X, MessageSquare, Headphones, AlertCircle } from 'lucide-react';
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
  const [error, setError] = useState<string | null>(null);
  const [transcription, setTranscription] = useState('');
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  const currentTurnTranscriptionRef = useRef('');

  const stopSession = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.close?.();
      sessionRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsActive(false);
    setIsConnecting(false);
    setTranscription('');
    currentTurnTranscriptionRef.current = '';
    setError(null);
  }, []);

  const startSession = async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const ai = getGeminiClient();
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
      } catch (err: any) {
        throw new Error("Mikrofon-Zugriff verweigert.");
      }

      const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = outputAudioContext;

      await inputAudioContext.resume();
      await outputAudioContext.resume();

      const now = new Date();
      const dateStr = now.toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      const timeStr = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

      const taskListSummary = tasks.length > 0 
        ? tasks.map(t => `- [${t.priority.toUpperCase()}] ${t.title}${t.time ? ' (Geplant für ' + t.time + ')' : ''}${t.completed ? ' [ERLEDIGT]' : ' [OFFEN]'}`).join('\n')
        : 'Deine Liste ist aktuell leer.';

      const addTaskTool: FunctionDeclaration = {
        name: 'addTask',
        description: 'Tool zum Erstellen einer NEUEN Aufgabe.',
        parameters: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            time: { type: Type.STRING },
            reminderAt: { type: Type.STRING },
            priority: { type: Type.STRING, enum: ['low', 'medium', 'high'] },
          },
          required: ['title'],
        },
      };

      const deleteTaskTool: FunctionDeclaration = {
        name: 'deleteTask',
        description: 'Löscht eine Aufgabe.',
        parameters: { type: Type.OBJECT, properties: { taskId: { type: Type.STRING } }, required: ['taskId'] },
      };

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            setIsActive(true);
            setIsConnecting(false);
            const source = inputAudioContext.createMediaStreamSource(stream);
            const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const l = inputData.length;
              const int16 = new Int16Array(l);
              for (let i = 0; i < l; i++) { int16[i] = inputData[i] * 32768; }
              const pcmBlob = { data: encodeBase64(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
              sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContext.destination);
          },
          onmessage: async (message) => {
            if (message.serverContent?.inputTranscription) {
              setTranscription(message.serverContent.inputTranscription.text);
            }
            if (message.toolCall) {
              for (const fc of message.toolCall.functionCalls) {
                if (fc.name === 'addTask') {
                  onAddTask({ id: Math.random().toString(36).substr(2, 9), title: fc.args.title, time: fc.args.time, priority: fc.args.priority || 'medium', completed: false });
                } else if (fc.name === 'deleteTask') {
                  onDeleteTask(fc.args.taskId);
                }
                sessionPromise.then(session => session.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: { result: "ok" } } }));
              }
            }
            const audioData = message.serverContent?.modelTurn?.parts?.find(p => p.inlineData)?.inlineData?.data;
            if (audioData) {
              const audioBuffer = await decodeAudioData(decodeBase64(audioData), outputAudioContext, 24000, 1);
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputAudioContext.currentTime);
              const source = outputAudioContext.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputAudioContext.destination);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
            }
          },
          onerror: () => stopSession(),
          onclose: () => stopSession()
        },
        config: {
          responseModalalities: [Modality.AUDIO],
          tools: [{ functionDeclarations: [addTaskTool, deleteTaskTool] }],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice } } },
          systemInstruction: `Du bist NoteHub, ein intelligenter Sprach-Assistent. Aktuelle Zeit: ${dateStr}, ${timeStr}. Deine Aufgabenliste:\n${taskListSummary}\nAntworte kurz und präzise.`,
          inputAudioTranscription: {},
        },
      });
      sessionRef.current = await sessionPromise;
    } catch (err: any) {
      setError(err.message);
      setIsConnecting(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-6 w-full">
      {isActive && (
        <div className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="bg-indigo-50/50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/50 rounded-[2rem] p-6 mb-4 shadow-inner">
            <div className="flex items-center gap-3 mb-3">
               <div className="p-2 bg-indigo-500 rounded-xl text-white"><MessageSquare className="w-4 h-4" /></div>
               <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">NoteHub Live</span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">{transcription || 'Ich höre zu...'}</p>
          </div>
        </div>
      )}
      <div className="flex flex-col items-center gap-4">
        <button onClick={isActive ? stopSession : startSession} disabled={isConnecting} className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all ${isActive ? 'bg-red-500 text-white' : 'bg-slate-800 dark:bg-indigo-600 text-white hover:scale-105 shadow-xl'}`}>
          {isConnecting ? <Loader2 className="w-10 h-10 animate-spin" /> : isActive ? <X className="w-10 h-10" /> : <Mic className="w-10 h-10" />}
          {isActive && <div className="absolute -inset-4 bg-red-500/20 rounded-full animate-ping -z-10" />}
        </button>
        <div className="text-center">
          <h3 className="font-bold text-slate-800 dark:text-slate-200">NoteHub Voice</h3>
          <p className="text-xs text-slate-400 mt-1">Briefing oder Aufgaben diktieren</p>
        </div>
      </div>
    </div>
  );
};

export default VoiceAssistant;
