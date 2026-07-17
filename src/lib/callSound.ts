/**
 * Plays a short, distinct chime when a call arrives while this tab is open.
 * Web push gives no control over the background/system notification sound
 * (see docs/RUNBOOK.md), so this is the only place a custom sound is
 * possible — and only while the page is alive to run it.
 *
 * Browsers block audio until a user gesture unlocks the AudioContext, so
 * `primeCallSound()` must run inside a click handler (the subscribe button
 * provides one) before a later `playCallSound()` — triggered by a push with
 * no gesture of its own — can be expected to actually produce sound.
 */
let audioContext: AudioContext | null = null;

export function primeCallSound(): void {
  audioContext ??= new AudioContext();
  if (audioContext.state === "suspended") {
    void audioContext.resume();
  }
}

// A5, C#6, E6: a bright ascending triad, chosen to be recognizable and
// unlike the single-tone "ding" most chat/social apps use by default.
const CHIME_NOTES_HZ = [880, 1108.73, 1318.51];

export function playCallSound(): void {
  const ctx = audioContext;
  if (!ctx) {
    return;
  }

  const now = ctx.currentTime;
  for (const [i, frequency] of CHIME_NOTES_HZ.entries()) {
    const start = now + i * 0.12;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.3, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.5);
  }
}
