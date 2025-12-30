
export type NotificationSoundType = 'Standard' | 'Chime' | 'Zen' | 'Digital' | 'None';

export const playNotificationSound = (type: NotificationSoundType) => {
  if (type === 'None') return;

  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  const playTone = (freq: number, startTime: number, duration: number, type: OscillatorType = 'sine') => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(0.2, startTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.start(startTime);
    osc.stop(startTime + duration);
  };

  switch (type) {
    case 'Chime':
      playTone(880, audioCtx.currentTime, 0.5);
      playTone(1108, audioCtx.currentTime + 0.1, 0.5);
      break;
    case 'Zen':
      playTone(440, audioCtx.currentTime, 1.5);
      playTone(659, audioCtx.currentTime + 0.2, 1.3);
      break;
    case 'Digital':
      playTone(1200, audioCtx.currentTime, 0.1, 'square');
      playTone(1200, audioCtx.currentTime + 0.15, 0.1, 'square');
      break;
    case 'Standard':
    default:
      playTone(523.25, audioCtx.currentTime, 0.3);
      playTone(659.25, audioCtx.currentTime + 0.15, 0.3);
      break;
  }
};
