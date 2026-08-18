import React, { useState, useEffect, useRef } from 'react';
import { VolumeX, Music } from 'lucide-react';

type SoundType = 'none' | 'music';

export const AmbientSound: React.FC = () => {
  const [activeSound, setActiveSound] = useState<SoundType>('none');
  const [volume] = useState<number>(0.3);
  const audioCtxRef = useRef<AudioContext | null>(null);
  
  // Node references for cleanup
  const nodesRef = useRef<{
    sourceNode?: AudioNode;
    gainNode?: GainNode;
    timerId?: number;
    intervalId?: any;
  }>({});

  const initAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  };

  const stopAllSounds = () => {
    // Clear scheduled callbacks/intervals
    if (nodesRef.current.intervalId) {
      clearInterval(nodesRef.current.intervalId);
    }
    if (nodesRef.current.timerId) {
      cancelAnimationFrame(nodesRef.current.timerId);
    }
    
    // Disconnect and stop node chains
    try {
      if (nodesRef.current.sourceNode) {
        (nodesRef.current.sourceNode as any).stop?.();
        nodesRef.current.sourceNode.disconnect();
      }
      if (nodesRef.current.gainNode) {
        nodesRef.current.gainNode.disconnect();
      }
    } catch (e) {
      console.warn("Error stopping audio nodes:", e);
    }
    
    nodesRef.current = {};
  };


  // Generate procedural Wind Chimes
  const playChimes = (ctx: AudioContext) => {
    stopAllSounds();

    // 1. Create subtle background wind rumble (Low volume filtered pink noise)
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0, b1, b2, b3, b4, b5, b6;
    b0 = b1 = b2 = b3 = b4 = b5 = b6 = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      b6 = white * 0.115926;
      output[i] *= 0.11; // compensation
    }

    const windNoise = ctx.createBufferSource();
    windNoise.buffer = noiseBuffer;
    windNoise.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(200, ctx.currentTime);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(volume * 0.15, ctx.currentTime);

    windNoise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(ctx.destination);

    windNoise.start();

    nodesRef.current.sourceNode = windNoise;
    nodesRef.current.gainNode = gainNode;

    // Chime notes frequencies
    const pentatonic = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50];

    const playChimeNote = () => {
      const freq = pentatonic[Math.floor(Math.random() * pentatonic.length)] * (Math.random() > 0.5 ? 2 : 1);
      const osc = ctx.createOscillator();
      const chimeGain = ctx.createGain();
      const reverbShim = ctx.createBiquadFilter();

      reverbShim.type = 'peaking';
      reverbShim.frequency.setValueAtTime(freq * 1.5, ctx.currentTime);
      reverbShim.Q.setValueAtTime(5, ctx.currentTime);
      reverbShim.gain.setValueAtTime(5, ctx.currentTime);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      chimeGain.gain.setValueAtTime(0.001, ctx.currentTime);
      chimeGain.gain.linearRampToValueAtTime(volume * 0.18, ctx.currentTime + 0.1);
      chimeGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 4.0);

      osc.connect(reverbShim);
      reverbShim.connect(chimeGain);
      chimeGain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 4.2);
    };

    const interval = setInterval(() => {
      if (Math.random() > 0.7) {
        playChimeNote();
      }
    }, 1800);

    nodesRef.current.intervalId = interval;
  };

  // Adjust volume dynamically
  useEffect(() => {
    if (nodesRef.current.gainNode && audioCtxRef.current) {
      nodesRef.current.gainNode.gain.setValueAtTime(
        volume * 0.15,
        audioCtxRef.current.currentTime
      );
    }
  }, [volume, activeSound]);

  // Handle sound transitions
  useEffect(() => {
    initAudio();
    const ctx = audioCtxRef.current;
    if (!ctx) return;

    if (activeSound === 'none') {
      stopAllSounds();
    } else if (activeSound === 'music') {
      playChimes(ctx);
    }

    return () => {
      // Don't tear down on simple re-renders, but clear if activeSound changes
    };
  }, [activeSound]);

  // Make sure we stop everything when the component unmounts
  useEffect(() => {
    return () => {
      stopAllSounds();
    };
  }, []);

  return (
    <button
      onClick={() => setActiveSound(activeSound === 'none' ? 'music' : 'none')}
      className={`flex items-center justify-center p-3.5 rounded-full shadow-lg border transition-all ${
        activeSound === 'music'
          ? 'bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700 hover:scale-105'
          : 'bg-white/80 hover:bg-white backdrop-blur-md border-black/5 text-neutral-600 hover:scale-105'
      }`}
      title={activeSound === 'music' ? 'Mute Music' : 'Play Music'}
    >
      {activeSound === 'music' ? <Music className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
    </button>
  );
};
