
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { DayPlan, Task } from "../types";

// Initialize GoogleGenAI client with the API key from environment variables.
export const getGeminiClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const SYSTEM_INSTRUCTION = `Du bist NoteHub, ein ruhiger, empathischer und kluger persönlicher Assistent. 

DEINE ROLLE:
Du bist mehr als nur eine To-Do-Liste. Du bist ein Mentor und Gesprächspartner. 
Nutzer können mit dir über alles reden: Sorgen, Fragen nach Produktivitätstipps, Empfehlungen für Pausengestaltung oder einfach Smalltalk.

VERHALTEN:
1. Empathisch & Hilfreich: Wenn der Nutzer nach Empfehlungen fragt (z.B. "Was kann ich gegen Stress tun?"), antworte fundiert und ruhig.
2. Kontext-Bewusstsein: Beziehe dich auf die existierenden Aufgaben, wenn es passt. 
3. Struktur: Nutze Markdown für Listen oder Hervorhebungen in deinen Antworten.

TECHNISCHE REGEL:
- Wenn der Nutzer Aufgaben plant, ändert oder einen neuen Plan möchte: Hänge am ENDE [PLAN_JSON] mit dem JSON-Objekt an.
- Wenn es ein reines Gespräch ist (Fragen, Tipps, Talk): Antworte NUR mit Text. Hänge KEIN leeres JSON an.

JSON-Struktur bei [PLAN_JSON]:
{
  "summary": "Zusammenfassung des Plans",
  "motivation": "Ein passender Satz für den Nutzer",
  "focus": "Die Kernaufgabe",
  "tasks": [{"id": "unique-id", "title": "Aufgabe", "time": "Zeit", "priority": "low/medium/high", "category": "Kategorie", "reminderAt": "HH:mm", "isImportant": boolean}]
}`;

export const startCoachingChat = () => {
  const ai = getGeminiClient();
  return ai.chats.create({
    model: 'gemini-3-flash-preview',
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      thinkingConfig: { thinkingBudget: 2000 }
    },
  });
};

export const generateAppLogo = async (): Promise<string> => {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: "Sophisticated minimalist app logo icon for 'NoteHub'. Abstract geometric symbol. Colors: charcoal and electric blue.",
    config: { imageConfig: { aspectRatio: "1:1" } }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
  }
  return "";
};

export const generateFocusImage = async (focus: string): Promise<string> => {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: `A very calm, minimalistic photography representing: ${focus}. soft lighting.`,
    config: { imageConfig: { aspectRatio: "16:9" } }
  });

  for (const part of response.candidates?.[0]?.content?.parts || []) {
    if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
  }
  return "";
};

export const generateBriefingAudio = async (tasks: Task[], focus?: string, motivation?: string, voiceName: string = 'Kore'): Promise<string> => {
  const ai = getGeminiClient();
  const openTasks = tasks.filter(t => !t.completed);
  const focusText = focus ? `Unser Fokus heute liegt auf: ${focus}.` : "Schauen wir uns deine anstehenden Aufgaben an.";
  const taskText = openTasks.length > 0 
    ? ` Deine wichtigsten offenen Punkte sind: ${openTasks.map(t => t.title).join(', ')}.`
    : " Du hast aktuell alle Aufgaben erledigt.";
  const motivationText = motivation ? ` Ein kleiner Impuls für dich: ${motivation}.` : " Ich wünsche dir einen ruhigen Tag.";

  const script = `Hallo! Hier ist NoteHub. ${focusText}${taskText}${motivationText}`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: script }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName } },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("Audio-Fehler.");
  return base64Audio;
};

// New function to read specific messages
export const generateMessageAudio = async (text: string, voiceName: string = 'Kore'): Promise<string> => {
  const ai = getGeminiClient();
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName } },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("Audio-Fehler.");
  return base64Audio;
};

export function encodeBase64(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) { binary += String.fromCharCode(bytes[i]); }
  return btoa(binary);
}

export function decodeBase64(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) { bytes[i] = binaryString.charCodeAt(i); }
  return bytes;
}

export async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const frameCount = data.byteLength / (2 * numChannels);
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  for (let i = 0; i < frameCount; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const index = (i * numChannels + channel) * 2;
      const sample = view.getInt16(index, true);
      buffer.getChannelData(channel)[i] = sample / 32768.0;
    }
  }
  return buffer;
}
