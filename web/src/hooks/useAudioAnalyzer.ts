"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export interface UseAudioAnalyzerReturn {
  frequencyData: Uint8Array;
  timeDomainData: Uint8Array;
  getAverageVolume: () => number;
  isActive: boolean;
}

const EMPTY = new Uint8Array(0);

/**
 * Connects to an external AnalyserNode and reads frequency/time-domain data
 * via requestAnimationFrame. Designed to work with the audioContext singleton.
 */
export function useAudioAnalyzer(analyserNode: AnalyserNode | null): UseAudioAnalyzerReturn {
  const [frequencyData, setFrequencyData] = useState<Uint8Array>(EMPTY);
  const [timeDomainData, setTimeDomainData] = useState<Uint8Array>(EMPTY);
  const [isActive, setIsActive] = useState(false);
  const rafRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const latestFrequencyRef = useRef<Uint8Array>(EMPTY);

  const getAverageVolume = useCallback((): number => {
    const data = latestFrequencyRef.current;
    if (data.length === 0) return 0;
    const sum = data.reduce((acc, val) => acc + val, 0);
    return sum / data.length / 255;
  }, []);

  useEffect(() => {
    if (!analyserNode) {
      setIsActive(false);
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    analyserRef.current = analyserNode;
    setIsActive(true);

    const freqBuffer = new Uint8Array(analyserNode.frequencyBinCount);
    const timeBuffer = new Uint8Array(analyserNode.fftSize);

    const tick = () => {
      if (!analyserRef.current) return;

      analyserRef.current.getByteFrequencyData(freqBuffer);
      analyserRef.current.getByteTimeDomainData(timeBuffer);

      const freqSnapshot = new Uint8Array(freqBuffer);
      const timeSnapshot = new Uint8Array(timeBuffer);

      latestFrequencyRef.current = freqSnapshot;
      setFrequencyData(freqSnapshot);
      setTimeDomainData(timeSnapshot);

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      analyserRef.current = null;
      setIsActive(false);
    };
  }, [analyserNode]);

  return {
    frequencyData,
    timeDomainData,
    getAverageVolume,
    isActive,
  };
}
