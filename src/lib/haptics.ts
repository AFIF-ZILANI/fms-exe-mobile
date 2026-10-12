import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

export type Buzz = 'success' | 'warning' | 'error';

// Two sounds, not three: a code that was already linked and a code that was
// rejected both mean "this one did not go through", so they sound the same.
const SOUND_FILES = {
  ok: require('../../assets/sounds/scan-ok.wav'),
  error: require('../../assets/sounds/scan-error.wav'),
};
const players: Partial<Record<keyof typeof SOUND_FILES, AudioPlayer>> = {};
let audioReady = false;

function player(kind: keyof typeof SOUND_FILES) {
  if (!audioReady) {
    audioReady = true;
    // Ring through silent mode (a noisy gate, a phone left on mute) without
    // pausing whatever else is playing.
    void setAudioModeAsync({ playsInSilentMode: true, interruptionMode: 'mixWithOthers' }).catch(() => {});
  }
  return (players[kind] ??= createAudioPlayer(SOUND_FILES[kind]));
}

/** Loads both sounds ahead of the first scan, so the first beep isn't the one that gets dropped. */
export function primeFeedback(): void {
  try {
    player('ok');
    player('error');
  } catch {
    // no sound is not a reason to lose the scan
  }
}

function play(kind: keyof typeof SOUND_FILES) {
  const p = player(kind);
  // Wait for the rewind: a short clip that has already finished is still at its end, and a
  // play() that lands before the seek does has nothing left to play.
  p.seekTo(0).then(() => p.play(), () => p.play());
}

/**
 * A short vibration and a sound confirming a scan landed (beep) or didn't (a
 * lower double buzz). On a noisy farm gate with the phone held at arm's
 * length, these carry better than the colour flash — the operator is looking
 * at the pallet, not the screen.
 *
 * Fire-and-forget, and never allowed to throw: haptics are unavailable in Low
 * Power Mode, when the user has switched them off, on some browsers, and on
 * devices with no vibration hardware; audio can fail to load or be blocked.
 * Feedback failing must never interrupt the scan it was reporting on.
 */
export function buzz(kind: Buzz): void {
  const type =
    kind === 'success'
      ? Haptics.NotificationFeedbackType.Success
      : kind === 'warning'
        ? Haptics.NotificationFeedbackType.Warning
        : Haptics.NotificationFeedbackType.Error;

  void Haptics.notificationAsync(type).catch(() => {});

  try {
    play(kind === 'success' ? 'ok' : 'error');
  } catch {
    // no sound is not a reason to lose the scan
  }
}
