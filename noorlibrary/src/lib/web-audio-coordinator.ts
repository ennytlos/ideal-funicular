/**
 * Web Audio Coordinator
 * Ensures mutually exclusive playback between full-Surah recitation and single-Ayah audio.
 */

type WebAudioCategory = "surah" | "verse";
type PauseFn = () => void;

const pauseCallbacks = new Map<WebAudioCategory, PauseFn>();

export function registerWebAudioPause(
  type: WebAudioCategory,
  pauseFn: PauseFn
): () => void {
  pauseCallbacks.set(type, pauseFn);
  return () => {
    if (pauseCallbacks.get(type) === pauseFn) {
      pauseCallbacks.delete(type);
    }
  };
}

export function notifyWebAudioStarted(type: WebAudioCategory): void {
  for (const [otherType, pauseFn] of pauseCallbacks.entries()) {
    if (otherType !== type) {
      try {
        pauseFn();
      } catch (err) {
        console.warn(`Error pausing web audio category ${otherType}:`, err);
      }
    }
  }
}
