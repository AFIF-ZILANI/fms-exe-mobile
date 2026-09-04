import { View } from 'react-native';
import { useTheme } from '@/hooks/use-theme';

export function Divider() {
  const theme = useTheme();
  return <View style={{ height: 1, backgroundColor: theme.line }} />;
}
