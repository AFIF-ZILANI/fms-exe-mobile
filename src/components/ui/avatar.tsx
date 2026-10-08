import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';

import { AppText } from '@/components/ui/text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { initials } from '@/lib/farm';

/** A person's photo, or their initials on a soft brand tint when there is none. */
export function Avatar({ name, uri, size = 40 }: { name: string; uri?: string | null; size?: number }) {
  const theme = useTheme();
  const box = { width: size, height: size, borderRadius: Radius.pill };

  return uri ? (
    <Image source={{ uri }} style={box} contentFit="cover" accessibilityLabel={`${name}'s photo`} />
  ) : (
    <View style={[styles.fallback, box, { backgroundColor: theme.primarySoft }]}>
      <AppText variant="data" color="primary">
        {initials(name)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
});
