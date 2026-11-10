import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type TextStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useFonts } from 'expo-font';
import { BarlowSemiCondensed_600SemiBold } from '@expo-google-fonts/barlow-semi-condensed/600SemiBold';
import { BarlowSemiCondensed_700Bold } from '@expo-google-fonts/barlow-semi-condensed/700Bold';
import { Archivo_700Bold } from '@expo-google-fonts/archivo/700Bold';
import { Archivo_800ExtraBold } from '@expo-google-fonts/archivo/800ExtraBold';
import { TiroBangla_400Regular } from '@expo-google-fonts/tiro-bangla/400Regular';
import { HindSiliguri_400Regular } from '@expo-google-fonts/hind-siliguri/400Regular';
import { HindSiliguri_600SemiBold } from '@expo-google-fonts/hind-siliguri/600SemiBold';
import { HindSiliguri_700Bold } from '@expo-google-fonts/hind-siliguri/700Bold';

/**
 * Design-direction preview, step 1 of the redesign: three candidate systems side by side, each on its own
 * ground. Self-contained on purpose — it uses none of the app's theme, so each direction is judged as itself.
 * Open with exp://<host>:8081/--/design-preview. Delete once a direction is picked and lives in the theme.
 */

type Direction = {
  key: string;
  name: string;
  why: string;
  fonts: { display: string; number: string; body: string; bodyStrong: string };
  colors: {
    primary: string;
    onPrimary: string;
    background: string;
    surface: string;
    text: string;
    muted: string;
    success: string;
    error: string;
    line: string;
  };
  radius: number;
  spacing: number[];
};

const DIRECTIONS: Direction[] = [
  {
    key: 'shed',
    name: 'Tin Shed',
    why: 'Galvanised-steel greys and shed-paint teal. Numbers set in a road-sign face, so they stay readable at arm’s length in a bright shed.',
    fonts: {
      display: 'BarlowSemiCondensed_700Bold',
      number: 'BarlowSemiCondensed_600SemiBold',
      body: 'HindSiliguri_400Regular',
      bodyStrong: 'HindSiliguri_600SemiBold',
    },
    colors: {
      primary: '#0B6B66',
      onPrimary: '#FFFFFF',
      background: '#E8ECEE',
      surface: '#FFFFFF',
      text: '#12181C',
      muted: '#56616A',
      success: '#2E7D32',
      error: '#B42318',
      line: '#D3D9DD',
    },
    radius: 6,
    spacing: [4, 8, 12, 16, 24, 32, 48],
  },
  {
    key: 'sack',
    name: 'Feed Sack',
    why: 'Taken from the printed feed sack: heavy wide letters and chick-yellow buttons nobody misses, even with gloves on.',
    fonts: {
      display: 'Archivo_800ExtraBold',
      number: 'Archivo_700Bold',
      body: 'HindSiliguri_400Regular',
      bodyStrong: 'HindSiliguri_600SemiBold',
    },
    colors: {
      primary: '#F2B705',
      onPrimary: '#151A12',
      background: '#FFFFFF',
      surface: '#EFF2EC',
      text: '#151A12',
      muted: '#586152',
      success: '#2B7A3D',
      error: '#C2361F',
      line: '#DDE2D8',
    },
    radius: 4,
    spacing: [8, 12, 16, 24, 32, 48],
  },
  {
    key: 'ledger',
    name: 'Hisab Khata',
    why: 'The ruled ledger every Bangladeshi business keeps: ink blue for actions, red only for losses and deaths, a calm serif for headings.',
    fonts: {
      display: 'TiroBangla_400Regular',
      number: 'HindSiliguri_700Bold',
      body: 'HindSiliguri_400Regular',
      bodyStrong: 'HindSiliguri_600SemiBold',
    },
    colors: {
      primary: '#1F3A5F',
      onPrimary: '#FFFFFF',
      background: '#EEF1F4',
      surface: '#FFFFFF',
      text: '#1A2230',
      muted: '#5B6576',
      success: '#2E7D4F',
      error: '#B3261E',
      line: '#D5DBE3',
    },
    radius: 10,
    spacing: [4, 8, 16, 24, 40],
  },
];

const ROLES: { role: keyof Direction['colors']; label: string }[] = [
  { role: 'primary', label: 'Primary' },
  { role: 'background', label: 'Background' },
  { role: 'surface', label: 'Surface' },
  { role: 'text', label: 'Text' },
  { role: 'muted', label: 'Muted text' },
  { role: 'success', label: 'Success' },
  { role: 'error', label: 'Error' },
];

const NUM: TextStyle = { fontVariant: ['tabular-nums'] };

export default function DesignPreviewScreen() {
  const [loaded] = useFonts({
    BarlowSemiCondensed_600SemiBold,
    BarlowSemiCondensed_700Bold,
    Archivo_700Bold,
    Archivo_800ExtraBold,
    TiroBangla_400Regular,
    HindSiliguri_400Regular,
    HindSiliguri_600SemiBold,
    HindSiliguri_700Bold,
  });
  const [picked, setPicked] = useState(DIRECTIONS[0].key);
  const d = DIRECTIONS.find((x) => x.key === picked) ?? DIRECTIONS[0];
  const c = d.colors;

  if (!loaded) return <View style={{ flex: 1, backgroundColor: c.background }} />;

  const body = (extra?: TextStyle): TextStyle => ({ fontFamily: d.fonts.body, color: c.text, fontSize: 17, lineHeight: 26, ...extra });
  const s = d.spacing;
  const gap = s[Math.min(3, s.length - 1)]; // the scale's "16-ish" step, used as the page rhythm

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.background }} edges={['top']}>
      <View style={[styles.switcher, { paddingHorizontal: 16, gap: 8 }]}>
        {DIRECTIONS.map((x) => {
          const on = x.key === picked;
          return (
            <Pressable
              key={x.key}
              onPress={() => setPicked(x.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[
                styles.switch,
                {
                  borderRadius: d.radius,
                  backgroundColor: on ? c.text : c.surface,
                  borderColor: c.line,
                },
              ]}
            >
              <Text style={{ fontFamily: d.fonts.bodyStrong, fontSize: 15, color: on ? c.background : c.text }}>{x.name}</Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 64, gap: gap * 1.5 }}>
        <View style={{ gap: 8 }}>
          <Text style={{ fontFamily: d.fonts.display, fontSize: 40, lineHeight: 46, color: c.text }}>{d.name}</Text>
          <Text style={body({ color: c.muted })}>{d.why}</Text>
        </View>

        {/* Type */}
        <View style={{ gap: 8 }}>
          <Text style={{ fontFamily: d.fonts.display, fontSize: 30, lineHeight: 36, color: c.text }}>Shed 2, batch 14</Text>
          <Text style={{ fontFamily: d.fonts.display, fontSize: 22, lineHeight: 28, color: c.text }}>Today’s weigh-in</Text>
          <Text style={body()}>Weighed 50 birds at 7 am. The average is up 62 g on yesterday, right on the target curve.</Text>
          <Text style={body({ color: c.muted })}>আজকের গড় ওজন ১.৮৪ কেজি, বিক্রয় মূল্য ৳১৮৬ প্রতি কেজি</Text>
        </View>

        {/* The card: the numbers lead */}
        <View style={{ backgroundColor: c.surface, borderRadius: d.radius, padding: s[Math.min(4, s.length - 1)], gap: 16, borderWidth: d.key === 'sack' ? 0 : 1, borderColor: c.line }}>
          <View>
            <Text style={body({ color: c.muted, fontSize: 15 })}>Average weight</Text>
            <Text style={[{ fontFamily: d.fonts.number, fontSize: 64, lineHeight: 72, color: c.text }, NUM]}>
              1.84<Text style={{ fontSize: 26, color: c.muted }}> kg</Text>
            </Text>
            <Text style={body({ color: c.success, fontFamily: d.fonts.bodyStrong, fontSize: 15 })}>+62 g since yesterday</Text>
          </View>
          <View style={{ height: 1, backgroundColor: c.line }} />
          <View style={styles.row}>
            <View>
              <Text style={body({ color: c.muted, fontSize: 15 })}>Sale price</Text>
              <Text style={[{ fontFamily: d.fonts.number, fontSize: 40, lineHeight: 48, color: c.text }, NUM]}>
                {/* Hind Siliguri carries the Taka sign; the display faces don't. */}
                <Text style={{ fontFamily: d.fonts.bodyStrong }}>৳</Text>186
                <Text style={{ fontSize: 18, color: c.muted }}> per kg</Text>
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={body({ color: c.muted, fontSize: 15 })}>Died today</Text>
              <Text style={[{ fontFamily: d.fonts.number, fontSize: 40, lineHeight: 48, color: c.error }, NUM]}>3</Text>
            </View>
          </View>
        </View>

        {/* Buttons */}
        <View style={{ gap: 12 }}>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.button, { borderRadius: d.radius, backgroundColor: c.primary, opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={{ fontFamily: d.fonts.bodyStrong, fontSize: 18, color: c.onPrimary }}>Record weight</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.button,
              { borderRadius: d.radius, backgroundColor: pressed ? c.line : c.surface, borderWidth: 1.5, borderColor: c.text },
            ]}
          >
            <Text style={{ fontFamily: d.fonts.bodyStrong, fontSize: 18, color: c.text }}>See batch</Text>
          </Pressable>
        </View>

        {/* Swatches */}
        <View style={styles.swatches}>
          {ROLES.map((r) => (
            <View key={r.role} style={styles.swatch}>
              <View style={{ height: 56, borderRadius: d.radius, backgroundColor: c[r.role], borderWidth: 1, borderColor: c.line }} />
              <Text style={body({ fontFamily: d.fonts.bodyStrong, fontSize: 14, lineHeight: 20 })}>{r.label}</Text>
              <Text style={[body({ color: c.muted, fontSize: 14, lineHeight: 18 }), NUM]}>{c[r.role]}</Text>
            </View>
          ))}
        </View>

        {/* Radius and spacing */}
        <View style={{ gap: 12 }}>
          <Text style={body({ fontFamily: d.fonts.bodyStrong })}>
            Corner radius {d.radius}. Spacing {s.join(', ')}.
          </Text>
          <View style={[styles.row, { alignItems: 'flex-end', justifyContent: 'flex-start', gap: 8 }]}>
            {s.map((v) => (
              <View key={v} style={{ alignItems: 'center', gap: 4 }}>
                <View style={{ width: v, height: v, backgroundColor: c.primary, borderRadius: Math.min(d.radius, v / 2) }} />
                <Text style={[body({ color: c.muted, fontSize: 13, lineHeight: 16 }), NUM]}>{v}</Text>
              </View>
            ))}
          </View>
        </View>

        <Pressable onPress={() => router.back()} accessibilityRole="button" style={{ alignSelf: 'flex-start', paddingVertical: 12 }}>
          <Text style={body({ fontFamily: d.fonts.bodyStrong, color: c.muted })}>Close preview</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  switcher: { flexDirection: 'row', paddingVertical: 12 },
  switch: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  button: { minHeight: 56, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  swatch: { width: '30%', flexGrow: 1, gap: 4 },
});
