"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Icon } from "@/components/ui/icon";

const noop = () => () => {};

/** Reads a summary aloud with the browser's built-in speech synthesis (no data leaves the device). */
export function ReadAloud({ text, label = "Read my day aloud" }: { text: string; label?: string }) {
  const supported = useSyncExternalStore(noop, () => "speechSynthesis" in window, () => false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  if (!supported) return null;

  const toggle = () => {
    const synth = window.speechSynthesis;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9; // a little slower is easier to follow
    utterance.lang = "en-IN";
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    synth.cancel();
    synth.speak(utterance);
    setSpeaking(true);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={speaking}
      className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line-2 bg-surface px-4 font-semibold text-ink hover:border-sky-300 hover:bg-sky-50"
    >
      <Icon name={speaking ? "stop" : "speaker"} className="size-5 text-sky-600" />
      {speaking ? "Stop reading" : label}
    </button>
  );
}
