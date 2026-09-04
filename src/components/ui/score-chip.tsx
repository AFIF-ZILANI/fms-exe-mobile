import { AppText } from '@/components/ui/text';
import type { Type } from '@/constants/theme';

type ScoreChipProps = {
  points: number;
  variant?: keyof Pick<typeof Type, 'reading' | 'figure' | 'data'>;
};

/** Signed points, success/critical/muted only -- never a third colour. */
export function ScoreChip({ points, variant = 'figure' }: ScoreChipProps) {
  const color = points > 0 ? 'success' : points < 0 ? 'critical' : 'muted';
  const text = points > 0 ? `+${points}` : String(points);
  return (
    <AppText variant={variant} color={color}>
      {text}
    </AppText>
  );
}
