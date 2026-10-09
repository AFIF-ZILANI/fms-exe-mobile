import { router } from 'expo-router';

/** Closes a screen. When there is nothing behind it (a deep link, a restored route) a plain `router.back()`
 *  throws "GO_BACK was not handled", so go home instead. */
export function goBack(): void {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
