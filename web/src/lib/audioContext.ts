/**
 * Singleton AudioContext manager for Jarvis voice system.
 * Creates the AudioContext lazily on first user gesture.
 */

interface AudioContextManager {
  context: AudioContext;
  micAnalyser: AnalyserNode;
  ttsAnalyser: AnalyserNode;
  getFrequencyData: (target: "mic" | "tts") => Uint8Array;
  getTimeDomainData: (target: "mic" | "tts") => Uint8Array;
  connectSource: (source: AudioNode, target: "mic" | "tts") => void;
  cleanup: () => void;
}

let instance: AudioContextManager | null = null;

function createAudioContextManager(): AudioContextManager {
  const context = new AudioContext();

  const micAnalyser = context.createAnalyser();
  micAnalyser.fftSize = 256;
  micAnalyser.smoothingTimeConstant = 0.8;

  const ttsAnalyser = context.createAnalyser();
  ttsAnalyser.fftSize = 256;
  ttsAnalyser.smoothingTimeConstant = 0.8;

  // Connect both analysers to destination so audio plays through
  micAnalyser.connect(context.destination);
  ttsAnalyser.connect(context.destination);

  const getFrequencyData = (target: "mic" | "tts"): Uint8Array => {
    const analyser = target === "mic" ? micAnalyser : ttsAnalyser;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    return data;
  };

  const getTimeDomainData = (target: "mic" | "tts"): Uint8Array => {
    const analyser = target === "mic" ? micAnalyser : ttsAnalyser;
    const data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);
    return data;
  };

  const connectSource = (source: AudioNode, target: "mic" | "tts"): void => {
    const analyser = target === "mic" ? micAnalyser : ttsAnalyser;
    source.connect(analyser);
  };

  const handleVisibilityChange = () => {
    if (document.hidden) {
      context.suspend().catch(() => {});
    } else {
      context.resume().catch(() => {});
    }
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);

  const cleanup = () => {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    micAnalyser.disconnect();
    ttsAnalyser.disconnect();
    context.close().catch(() => {});
    instance = null;
  };

  return {
    context,
    micAnalyser,
    ttsAnalyser,
    getFrequencyData,
    getTimeDomainData,
    connectSource,
    cleanup,
  };
}

/**
 * Returns the singleton AudioContextManager, creating it on first call.
 * Must be called from a user gesture handler.
 */
export function getAudioContextManager(): AudioContextManager {
  if (!instance) {
    instance = createAudioContextManager();
  }
  return instance;
}

/**
 * Returns the singleton if it already exists, null otherwise.
 * Safe to call outside a user gesture.
 */
export function getExistingAudioContextManager(): AudioContextManager | null {
  return instance;
}

export type { AudioContextManager };
