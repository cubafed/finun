"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export type StudyPosition = {
  lectureId: string;
  seconds: number;
  updated: number;
};
const key = "ilyich-study-position-v1";

// Device-local listening position; shared materials and marks remain on the server.
export function useStudyHistory() {
  const [position, setPosition] = useState<StudyPosition | null>(null);
  const latest = useRef<StudyPosition | null>(null);
  useEffect(() => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      if (
        typeof value?.lectureId === "string" &&
        Number.isFinite(value.seconds) &&
        value.seconds >= 0
      ) {
        latest.current = value;
        // Client storage is unavailable during server rendering; hydrate after mount.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPosition(value);
      }
    } catch {
      /* Storage may be unavailable in private browsing. */
    }
  }, []);
  const remember = useCallback((lectureId: string, seconds?: number) => {
    const previous = latest.current;
    const next = {
      lectureId,
      seconds:
        seconds ?? (previous?.lectureId === lectureId ? previous.seconds : 0),
      updated: Date.now(),
    };
    latest.current = next;
    setPosition(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* Reading still works without storage. */
    }
  }, []);
  return { position, remember };
}
