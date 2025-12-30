
import React from 'react';
import { Smile, Meh, Frown, Sun, CloudRain, Zap } from 'lucide-react';

interface MoodTrackerProps {
  currentMood: string;
  onMoodSelect: (mood: string) => void;
}

const MOODS = [
  { id: 'great', icon: Sun, label: 'Super', color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20' },
  { id: 'good', icon: Smile, label: 'Gut', color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20' },
  { id: 'neutral', icon: Meh, label: 'Okay', color: 'text-slate-400', bg: 'bg-slate-50 dark:bg-slate-800' },
  { id: 'low', icon: Frown, label: 'Niedrig', color: 'text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/20' },
  { id: 'bad', icon: CloudRain, label: 'Schlecht', color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
  { id: 'stressed', icon: Zap, label: 'Stress', color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20' },
];

const MoodTracker: React.FC<MoodTrackerProps> = ({ currentMood, onMoodSelect }) => {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] p-6 shadow-sm border border-transparent hover:border-slate-100 dark:hover:border-slate-800 transition-all">
      <div className="flex items-center justify-between mb-4 px-2">
        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Wie fühlst du dich?</h3>
        {currentMood && (
          <span className="text-[9px] font-bold text-indigo-500 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full animate-in fade-in slide-in-from-right-2">
            Geloggt
          </span>
        )}
      </div>
      
      <div className="flex justify-between gap-2">
        {MOODS.map((mood) => {
          const Icon = mood.icon;
          const isSelected = currentMood === mood.id;
          
          return (
            <button
              key={mood.id}
              onClick={() => onMoodSelect(mood.id)}
              className={`
                group relative flex flex-col items-center gap-2 p-2 rounded-2xl transition-all duration-300
                ${isSelected ? mood.bg : 'hover:bg-slate-50 dark:hover:bg-slate-800'}
              `}
              title={mood.label}
            >
              <div className={`
                p-2 rounded-xl transition-all duration-300
                ${isSelected ? 'scale-110' : 'group-hover:scale-105'}
              `}>
                <Icon className={`w-5 h-5 ${isSelected ? mood.color : 'text-slate-300 dark:text-slate-600 group-hover:text-slate-400'}`} />
              </div>
              
              {isSelected && (
                <div className="absolute -bottom-1 w-1 h-1 bg-indigo-500 rounded-full animate-in zoom-in" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MoodTracker;
