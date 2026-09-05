import Feather from '@expo/vector-icons/Feather';
import { View, StyleSheet } from 'react-native';

import { Radius, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type IconName = keyof typeof Feather.glyphMap;

type IconProps = {
  name: IconName;
  /** 24 nav/action · 20 inline · 16 inside chips and pills. docs/design.md §5. */
  size?: number;
  color?: ThemeColor;
};

export function Icon({ name, size = 24, color = 'ink' }: IconProps) {
  const theme = useTheme();
  return <Feather name={name} size={size} color={theme[color]} />;
}

type IconTileProps = {
  name: IconName;
  /** The tint the tile is filled with. Pair it with a matching `color`. */
  tint: Extract<ThemeColor, 'tintGreen' | 'tintAmber' | 'tintRed' | 'tintBlue' | 'surfaceAlt' | 'primarySoft'>;
  color?: ThemeColor;
  /** 40 is the standard tile; 32 in a ledger gutter, 56 in an empty state. */
  size?: 32 | 40 | 56;
};

/** A tinted square holding one icon — the device that carries domain identity
 *  in lists, sheets and empty states. docs/design.md §5. */
export function IconTile({ name, tint, color = 'ink', size = 40 }: IconTileProps) {
  const theme = useTheme();
  const glyph = size === 32 ? 18 : size === 56 ? 24 : 20;

  return (
    <View
      style={[
        styles.tile,
        { width: size, height: size, backgroundColor: theme[tint] },
      ]}
    >
      <Feather name={name} size={glyph} color={theme[color]} />
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    borderRadius: Radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
