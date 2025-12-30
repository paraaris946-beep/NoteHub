
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
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const stopSession = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.close?.();
      sessionRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close();
      inputAudioContextRef.current = null;
    }
    if (audioContextRef.current) {
      for (const source of sourcesRef.current) {
        try { source.stop(); } catch(e) {}
      }
      sourcesRef.current.clear();
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setIsActive(false);
    setIsConnecting(false);
    setTranscription('');
  }, []);

  const startSession = async () => {
    setIsConnecting(true);
    setError(null);
    try {
      const ai = getGeminiClient();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
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

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            setIsActive(true);
            setIsConnecting(false);
            const source = inCtx.createMediaStreamSource(stream);
            const scriptProcessor = inCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) { int16[i] = inputData[i] * 32767; }
              const pcmBlob = { data: encodeBase64(new Uint8Array(int16.buffer)), mimeType: 'audio/pcm;rate=16000' };
              sessionPromise.then(s => s.sendRealtimeInput({ media: pcmBlob }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inCtx.destination);
          },
          onmessage: async (msg) => {
            if (msg.serverContent?.inputTranscription) setTranscription(msg.serverContent.inputTranscription.text);
            if (msg.serverContent?.interrupted) {
              for (const s of sourcesRef.current) try { s.stop(); } catch(e) {}
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
            if (msg.toolCall) {
              for (const fc of msg.toolCall.functionCalls) {
                if (fc.name === 'addTask') onAddTask({ id: Math.random().toString(36).substr(2, 9), title: fc.args.title, time: fc.args.time, priority: fc.args.priority || 'medium', completed: false });
                if (fc.name === 'playBriefing') onPlayBriefing();
                sessionPromise.then(s => s.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: { result: "ok" } } }));
              }
            }
            const audio = msg.serverContent?.modelTurn?.parts?.find(p => p.inlineData)?.inlineData?.data;
            if (audio && outCtx) {
              const buf = await decodeAudioData(decodeBase64(audio), outCtx, 24000, 1);
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outCtx.currentTime);
              const source = outCtx.createBufferSource();
              source.buffer = buf;
              source.connect(outCtx.destination);
              source.onended = () => sourcesRef.current.delete(source);
              sourcesRef.current.add(source);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += buf.duration;
            }
          },
          onerror: (e) => { console.error(e); stopSession(); },
          onclose: () => stopSession()
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
      setError(err.message);
      setIsConnecting(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {isActive && (
        <div className="w-full p-4 bg-indigo-50/50 dark:bg-indigo-900/20 rounded-2xl mb-4 border border-indigo-100 dark:border-indigo-800">
          <p className="text-xs font-bold text-indigo-400 uppercase mb-2">NoteHub Live</p>
          <p className="text-sm dark:text-slate-200">{transcription || 'Höre zu...'}</p>
        </div>
      )}
      <button onClick={isActive ? stopSession : startSession} disabled={isConnecting} className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${isActive ? 'bg-red-500 shadow-red-500/20 animate-pulse' : 'bg-indigo-600 shadow-indigo-600/20'} text-white shadow-xl`}>
        {isConnecting ? <Loader2 className="w-10 h-10 animate-spin" /> : isActive ? <X className="w-10 h-10" /> : <Mic className="w-10 h-10" />}
      </button>
      <div className="text-center">
        <h3 className="font-bold text-slate-800 dark:text-slate-200">NoteHub Voice</h3>
        <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mt-1">Briefing oder Aufgaben diktieren</p>
      </div>
    </div>
  );
};

export default VoiceAssistant;
