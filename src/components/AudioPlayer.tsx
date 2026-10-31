"use client";

import { useEffect, useRef, useState } from "react";

interface AudioPlayerProps {
  url: string;
  title?: string;
  fileName?: string;
}

const RATES = [0.75, 1, 1.25, 1.5];

function formatTime(sec: number): string {
  if (isNaN(sec) || !isFinite(sec)) return "00:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function AudioPlayer({ url, title, fileName }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rateIdx, setRateIdx] = useState(1); // 1x default
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => {
      if (!isSeeking) setCurrentTime(audio.currentTime);
    };
    const onLoadedMetadata = () => {
      setDuration(audio.duration || 0);
    };
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };
    const onWaiting = () => setIsLoading(true);
    const onCanPlay = () => setIsLoading(false);

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("canplay", onCanPlay);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("canplay", onCanPlay);
    };
  }, [isSeeking]);

  // Handle Play / Pause
  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch((err) => console.error("Lỗi phát audio:", err));
    }
  };

  // Skip backwards / forwards (5 seconds)
  const skip = (delta: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const target = Math.max(0, Math.min(duration || 0, audio.currentTime + delta));
    audio.currentTime = target;
    setCurrentTime(target);
  };

  // Change speed
  const cycleSpeed = () => {
    const nextIdx = (rateIdx + 1) % RATES.length;
    setRateIdx(nextIdx);
    const nextRate = RATES[nextIdx];
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  // Seek bar handling
  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    setSeekValue(val);
    setCurrentTime(val);
  };

  const handleSeekStart = () => {
    setIsSeeking(true);
  };

  const handleSeekEnd = (e: React.MouseEvent<HTMLInputElement> | React.TouchEvent<HTMLInputElement>) => {
    setIsSeeking(false);
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = Number((e.target as HTMLInputElement).value);
    }
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="rounded-xl border border-border bg-surface/95 p-3.5 shadow-sm backdrop-blur-sm sm:p-4">
      <audio ref={audioRef} src={url} preload="metadata" />

      {/* Header bar: Icon + Title + Speed */}
      <div className="flex items-center justify-between gap-2 pb-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18V5l12-2v13" strokeLinejoin="round" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          </div>
          <span className="truncate text-xs font-medium text-foreground sm:text-sm">
            {fileName || title || "Bản thu âm / Backing track"}
          </span>
        </div>

        {/* Speed button */}
        <button
          type="button"
          onClick={cycleSpeed}
          title="Tốc độ phát (chạm để đổi)"
          className="shrink-0 rounded-md border border-border bg-surface-2 px-2 py-0.5 text-xs font-semibold tabular-nums text-foreground hover:border-accent"
        >
          {RATES[rateIdx]}x
        </button>
      </div>

      {/* Seekbar and Timing */}
      <div className="flex items-center gap-2.5">
        <span className="w-10 text-right font-mono text-xs tabular-nums text-muted">
          {formatTime(currentTime)}
        </span>

        <div className="relative flex-1">
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={isSeeking ? seekValue : currentTime}
            onChange={handleSeekChange}
            onMouseDown={handleSeekStart}
            onTouchStart={handleSeekStart}
            onMouseUp={handleSeekEnd}
            onTouchEnd={handleSeekEnd}
            className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-surface-2 accent-accent"
            aria-label="Thanh thời gian nghe"
            style={{
              background: `linear-gradient(to right, var(--color-accent) 0%, var(--color-accent) ${progressPercent}%, var(--color-surface-2) ${progressPercent}%, var(--color-surface-2) 100%)`,
            }}
          />
        </div>

        <span className="w-10 text-left font-mono text-xs tabular-nums text-muted">
          {formatTime(duration)}
        </span>
      </div>

      {/* Controls: Skip -5s, Play/Pause, Skip +5s */}
      <div className="mt-2.5 flex items-center justify-center gap-4">
        <button
          type="button"
          onClick={() => skip(-5)}
          title="Lùi 5 giây"
          aria-label="Lùi 5 giây"
          className="flex size-9 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-foreground"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 4v6h6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" strokeLinecap="round" strokeLinejoin="round" />
            <text x="12" y="15" fontSize="7" fontWeight="bold" textAnchor="middle" fill="currentColor" stroke="none">
              5
            </text>
          </svg>
        </button>

        <button
          type="button"
          onClick={togglePlay}
          title={isPlaying ? "Tạm dừng" : "Phát nhạc"}
          aria-label={isPlaying ? "Tạm dừng" : "Phát nhạc"}
          className="flex size-11 items-center justify-center rounded-full bg-accent text-accent-fg shadow-sm transition hover:scale-105 active:scale-95"
        >
          {isLoading ? (
            <svg className="size-5 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
          ) : isPlaying ? (
            <svg viewBox="0 0 24 24" className="size-5 fill-current">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="size-5 translate-x-0.5 fill-current">
              <path d="M5 3l14 9-14 9V3z" />
            </svg>
          )}
        </button>

        <button
          type="button"
          onClick={() => skip(5)}
          title="Tới 5 giây"
          aria-label="Tới 5 giây"
          className="flex size-9 items-center justify-center rounded-full text-muted hover:bg-surface-2 hover:text-foreground"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 4v6h-6" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10" strokeLinecap="round" strokeLinejoin="round" />
            <text x="12" y="15" fontSize="7" fontWeight="bold" textAnchor="middle" fill="currentColor" stroke="none">
              5
            </text>
          </svg>
        </button>
      </div>
    </div>
  );
}
