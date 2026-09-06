import * as Haptics from 'expo-haptics';

export type Buzz = 'success' | 'warning' | 'error';

/**
 * A short vibration confirming a scan landed. On a noisy farm gate with the
 * phone held at arm's length, this carries better than the colour flash — the
 * operator is looking at the pallet, not the screen.
 *
 * Fire-and-forget, and never allowed to throw: haptics are unavailable in Low
 * Power Mode, when the user has switched them off, on some browsers, and on
 * devices with no vibration hardware. Feedback failing must never interrupt
 * the scan it was reporting on.
 */
export function buzz(kind: Buzz): void {
  const type =
    kind === 'success'
      ? Haptics.NotificationFeedbackType.Success
      : kind === 'warning'
        ? Haptics.NotificationFeedbackType.Warning
        : Haptics.NotificationFeedbackType.Error;

  void Haptics.notificationAsync(type).catch(() => {});
}
