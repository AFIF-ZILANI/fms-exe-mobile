import { useState, type ComponentProps } from 'react';
import { Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import * as Clipboard from 'expo-clipboard';

import { InfoCard, InfoRow, openLink } from '@/components/profile-parts';
import { categoryIcon } from '@/components/stock-item-row';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Header } from '@/components/ui/header';
import { Icon, IconTile, type IconName } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/skeleton';
import { AppText } from '@/components/ui/text';
import { Radius, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useGetData } from '@/lib/api';
import { formatMoney, formatRelative, formatTime } from '@/lib/format';
import { tick } from '@/lib/haptics';
import { codeTail } from '@/lib/house-stock';
import { formatDate, humanise } from '@/lib/profile-format';
import { formatBalance } from '@/lib/stock-summary';
import {
  expiryState,
  lotCodesSummary,
  movementTitle,
  unitLeft,
  unitStatus,
  usageTitle,
  type UnitProfile,
} from '@/lib/unit-profile';

const TONE: Record<'success' | 'info' | 'warning' | 'critical' | 'neutral', { fg: ThemeColor; bg: ThemeColor }> = {
  success: { fg: 'success', bg: 'tintGreen' },
  info: { fg: 'info', bg: 'tintBlue' },
  warning: { fg: 'warning', bg: 'tintAmber' },
  critical: { fg: 'critical', bg: 'tintRed' },
  neutral: { fg: 'muted', bg: 'surfaceAlt' },
};

/** "2 Nov 2026 · 14:30" for an instant. */
const stamp = (iso: string) => `${formatDate(iso) ?? ''} · ${formatTime(iso)}`;

/** stock-unit/:id -- everything known about one coded unit: what it is, where it is and how much is left,
 *  the purchase it came from, and every move and use. Opened from "Look up a code". */
export default function StockUnitScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const [now, setNow] = useState(() => new Date());
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const q = useGetData<UnitProfile>(`/stock-units/${id}/profile`, ['stock-unit-profile', id]);
  const p = q.data;

  const refresh = async () => {
    setRefreshing(true);
    try {
      setNow(new Date());
      await q.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const copy = async () => {
    await Clipboard.setStringAsync(id).catch(() => {});
    tick();
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const body = () => {
    if (q.isPending) return <Skeleton height={320} />;
    if (q.isError && !p)
      return (
        <Card>
          <EmptyState
            compact
            icon="alert-circle"
            tint="tintRed"
            title="Couldn't load this code."
            body="Check your connection and try again."
            action={{ label: 'Retry', onPress: () => void q.refetch() }}
          />
        </Card>
      );
    if (!p) return null;

    const category = p.item?.category ?? null;
    const status = unitStatus(p.status, category);
    const tone = TONE[status.tone];
    const left = unitLeft(p);
    const expiry = expiryState(p.lot?.expiration_date ?? null, now);

    return (
      <>
        {/* What it is, its state, and the code to copy. */}
        <Card style={styles.hero}>
          <View style={styles.heroTop}>
            <IconTile name={p.item ? categoryIcon(p.item.category) : 'maximize'} tint="primarySoft" color="primary" size={56} />
            <View style={styles.flex}>
              <AppText variant="h2" numberOfLines={3}>
                {p.item?.name ?? 'Unlinked code'}
              </AppText>
              <View style={styles.chips}>
                {p.item ? <Chip label={humanise(p.item.category)} fg="muted" bg="surfaceAlt" /> : null}
                <Chip label={status.label} fg={tone.fg} bg={tone.bg} dot />
              </View>
            </View>
          </View>

          <Pressable
            onPress={() => void copy()}
            accessibilityRole="button"
            accessibilityLabel="Copy the full code"
            style={({ pressed }) => [styles.code, { backgroundColor: theme.surfaceAlt }, pressed && { opacity: 0.7 }]}
          >
            <Icon name="maximize" size={18} color="muted" />
            <View style={styles.flex}>
              <AppText variant="caption" color="muted">
                Code
              </AppText>
              <AppText variant="data" numberOfLines={1} ellipsizeMode="middle">
                {id}
              </AppText>
            </View>
            <View style={[styles.copy, { backgroundColor: copied ? theme.tintGreen : theme.primarySoft }]}>
              <Icon name={copied ? 'check' : 'copy'} size={16} color={copied ? 'success' : 'primary'} />
              <AppText variant="label" color={copied ? 'success' : 'primary'}>
                {copied ? 'Copied' : 'Copy'}
              </AppText>
            </View>
          </Pressable>

          {left ? (
            <View style={styles.left}>
              <View style={styles.leftHead}>
                <AppText variant="label" color="muted">
                  Left in this unit
                </AppText>
                <AppText variant="bodyStrong">{left.text}</AppText>
              </View>
              <View style={[styles.track, { backgroundColor: theme.line }]}>
                <View
                  style={[
                    styles.fill,
                    {
                      width: `${Math.round(left.share * 100)}%`,
                      backgroundColor: left.share <= 0.2 ? theme.warning : theme.success,
                    },
                  ]}
                />
              </View>
            </View>
          ) : null}
        </Card>

        {expiry ? (
          <Banner icon="alert-triangle" fg={TONE[expiry.tone].fg} bg={TONE[expiry.tone].bg} text={`${expiry.label} — check before using.`} />
        ) : null}

        {!p.item ? (
          <Card style={styles.gap}>
            <EmptyState
              compact
              icon="link"
              tint="tintAmber"
              title="This code isn't linked to a purchase yet."
              body="A manager links printed codes to a delivery with Link items. Until then there's nothing else to show."
            />
          </Card>
        ) : (
          <>
            {p.location ? (
              <Card style={styles.gap}>
                <View style={styles.where}>
                  <IconTile
                    name={p.location.type === 'HOUSE' ? 'home' : 'archive'}
                    tint={p.location.type === 'HOUSE' ? 'tintGreen' : 'tintBlue'}
                    color={p.location.type === 'HOUSE' ? 'success' : 'info'}
                  />
                  <View style={styles.flex}>
                    <AppText variant="caption" color="muted">
                      {p.status === 'CONSUMED' || p.status === 'DISPOSED' || p.status === 'SOLD' ? 'Last seen at' : 'Where it is now'}
                    </AppText>
                    <AppText variant="bodyStrong">{p.location.name}</AppText>
                    {p.location.since ? (
                      <AppText variant="caption" color="muted">
                        {p.location.type === 'HOUSE' ? 'Arrived' : 'Since'} {formatRelative(p.location.since)}
                      </AppText>
                    ) : null}
                  </View>
                </View>
                {p.asset ? (
                  <View style={[styles.assetRow, { borderTopColor: theme.line }]}>
                    <Icon name="tool" size={16} color="muted" />
                    <AppText variant="caption" color="muted" style={styles.flex}>
                      Equipment record: {p.asset.name} · {humanise(p.asset.status)}
                    </AppText>
                  </View>
                ) : null}
              </Card>
            ) : null}

            {p.purchase && p.lot ? (
              <InfoCard title="Purchase">
                <InfoRow label="Bought on" value={formatDate(p.purchase.purchase_date)} />
                <InfoRow
                  label="Supplier"
                  value={
                    p.purchase.supplier
                      ? [p.purchase.supplier.name, p.purchase.supplier.company].filter(Boolean).join(' · ')
                      : 'Not recorded'
                  }
                />
                {p.purchase.supplier?.mobile ? (
                  <InfoRow
                    label="Supplier phone"
                    value={p.purchase.supplier.mobile}
                    icon="phone"
                    onPress={() => openLink(`tel:${p.purchase!.supplier!.mobile}`)}
                  />
                ) : null}
                <InfoRow label="Invoice" value={p.purchase.invoice_no ?? 'None'} />
                {/* Prices come only to managers; for a worker the server sends them empty. */}
                {p.lot.cost_per_unit || p.lot.unit_price ? (
                  <InfoRow
                    label="Price"
                    value={
                      p.lot.cost_per_unit
                        ? `${formatMoney(p.lot.cost_per_unit)} each`
                        : `${formatMoney(p.lot.unit_price!)} per ${humanise(p.lot.unit).toLowerCase()}`
                    }
                  />
                ) : null}
                <InfoRow
                  label="Lot"
                  value={`${formatBalance(Number(p.lot.quantity))} ${humanise(p.lot.unit).toLowerCase()}${
                    p.lot.total_price ? ` · ${formatMoney(p.lot.total_price)}` : ''
                  }`}
                />
                {p.lot.mfg_date ? <InfoRow label="Made on" value={formatDate(p.lot.mfg_date)} /> : null}
                {p.lot.expiration_date ? <InfoRow label="Expires" value={formatDate(p.lot.expiration_date)} /> : null}
                <InfoRow label="Bought into" value={p.purchase.warehouse} />
                <InfoRow label="Recorded by" value={p.purchase.recorded_by} last={!p.bound_at} />
                {p.bound_at ? (
                  <InfoRow
                    label="Code linked"
                    value={`${formatDate(p.bound_at)}${p.bound_by ? ` · ${p.bound_by}` : ''}`}
                    last
                  />
                ) : null}
              </InfoCard>
            ) : null}

            {p.lot && Object.keys(p.lot.codes).length > 0 ? (
              <InfoCard title="Other codes in this lot">
                <InfoRow
                  label={`${Object.values(p.lot.codes).reduce((a, b) => a + (b ?? 0), 0)} codes`}
                  value={lotCodesSummary(p.lot.codes, category)}
                  last={!p.remaining || category === 'EQUIPMENT'}
                />
                {/* Equipment is never used up, so "left" means nothing for it. */}
                {p.remaining && category !== 'EQUIPMENT' ? (
                  <InfoRow
                    label="Left in the lot"
                    value={`${formatBalance(Math.max(0, Number(p.remaining.lot)))} ${humanise(p.item.unit).toLowerCase()}`}
                    last
                  />
                ) : null}
              </InfoCard>
            ) : null}

            <Timeline
              title="Movement history"
              empty="Never moved: still in the warehouse it was bought into."
              rows={p.movements.map((m) => ({
                id: m.id,
                icon: m.house ? 'arrow-right' : 'corner-up-left',
                fg: m.house ? 'success' : 'info',
                bg: m.house ? 'tintGreen' : 'tintBlue',
                title: movementTitle(m),
                meta: m.by,
                at: m.at,
              }))}
            />
            <Timeline
              title="Usage history"
              empty="Not used yet."
              rows={p.uses.map((u) => ({
                id: u.id,
                icon: 'droplet',
                fg: 'warning',
                bg: 'tintAmber',
                title: usageTitle(u),
                meta: [u.treatment, u.batch_code, u.by, u.note].filter(Boolean).join(' · '),
                at: u.at,
              }))}
            />
          </>
        )}

        <View style={styles.again}>
          <Button variant="secondary" label="Scan another code" block onPress={() => router.replace('/scan/lookup' as Href)} />
        </View>
      </>
    );
  };

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}>
      <Header title="Item details" eyebrow={codeTail(id)} leading="back" />
      {body()}
    </Screen>
  );
}

function Chip({ label, fg, bg, dot }: { label: string; fg: ThemeColor; bg: ThemeColor; dot?: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.chip, { backgroundColor: theme[bg] }]}>
      {dot ? <View style={[styles.dot, { backgroundColor: theme[fg] }]} /> : null}
      <AppText variant="caption" color={fg}>
        {label}
      </AppText>
    </View>
  );
}

function Banner({ icon, fg, bg, text }: { icon: IconName; fg: ThemeColor; bg: ThemeColor; text: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.banner, { backgroundColor: theme[bg] }]}>
      <Icon name={icon} size={18} color={fg} />
      <AppText variant="label" color={fg} style={styles.flex}>
        {text}
      </AppText>
    </View>
  );
}

type Tile = ComponentProps<typeof IconTile>;
type TimelineRow = { id: string; icon: IconName; fg: Tile['color']; bg: Tile['tint']; title: string; meta: string | null; at: string };

/** Newest first, one row per event: what happened, who, when. */
function Timeline({ title, empty, rows }: { title: string; empty: string; rows: TimelineRow[] }) {
  const theme = useTheme();
  return (
    <Card rows eyebrow={title} note={rows.length ? String(rows.length) : undefined} style={styles.gap}>
      {rows.length === 0 ? (
        <AppText variant="caption" color="muted" style={styles.empty}>
          {empty}
        </AppText>
      ) : (
        rows.map((r, i) => (
          <View key={r.id} style={[styles.event, i > 0 && { borderTopWidth: 1, borderTopColor: theme.line }]}>
            <IconTile name={r.icon} tint={r.bg} color={r.fg} size={32} />
            <View style={styles.flex}>
              <AppText variant="bodyStrong" numberOfLines={2}>
                {r.title}
              </AppText>
              {r.meta ? (
                <AppText variant="caption" color="muted" numberOfLines={2}>
                  {r.meta}
                </AppText>
              ) : null}
            </View>
            <AppText variant="caption" color="muted" style={styles.when}>
              {stamp(r.at)}
            </AppText>
          </View>
        ))
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: { gap: Spacing.lg, marginTop: Spacing.md },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  code: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.card,
  },
  copy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.pill,
  },
  left: { gap: Spacing.sm },
  leftHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  track: { height: 8, borderRadius: Radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.pill },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: Radius.card,
    marginTop: Spacing.md,
  },
  gap: { marginTop: Spacing.md },
  where: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  assetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderTopWidth: 1,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
  },
  event: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  when: { textAlign: 'right', maxWidth: 96 },
  empty: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  again: { marginTop: Spacing.xl },
});
