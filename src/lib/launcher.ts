import type { IconName } from '../components/ui/icon';

export type LauncherItem = {
  label: string;
  description: string;
  path: string;
  icon: IconName;
  tint: 'tintGreen' | 'tintAmber' | 'tintRed' | 'tintBlue';
};

export type LauncherGroup = { title: string; items: LauncherItem[] };

/**
 * What the [+] launcher offers. Pure, so "a Worker is never offered a manager tool" is
 * a tested fact and not an accident of the sheet's JSX. docs/navigation-redesign-design.md.
 * `houseId` is set when the sheet was opened from a house; only house-scoped screens get it.
 */
export function buildLauncher(isManager: boolean, houseId: string | null): LauncherGroup[] {
  const withHouse = (path: string) => (houseId ? `${path}?house_id=${houseId}` : path);

  const record: LauncherItem[] = [
    { label: 'Mortality', description: 'Birds that died today', path: withHouse('/log/mortality'), icon: 'alert-circle', tint: 'tintRed' },
    { label: 'Feed', description: 'Feed or supplies drawn', path: withHouse('/log/consumption'), icon: 'package', tint: 'tintAmber' },
    { label: 'Weight', description: 'Average sample weight', path: withHouse('/log/weight'), icon: 'bar-chart-2', tint: 'tintBlue' },
    { label: 'Environment', description: 'Temperature, humidity, gas', path: withHouse('/log/environment'), icon: 'thermometer', tint: 'tintBlue' },
    { label: 'Treatment', description: 'Medication or vaccination', path: withHouse('/log/treatment'), icon: 'plus-square', tint: 'tintGreen' },
  ];

  const stock: LauncherItem[] = [
    { label: 'Stock levels', description: 'What is on hand, what is low', path: '/stock', icon: 'archive', tint: 'tintBlue' },
    { label: 'Move to house', description: 'Scan units into a house', path: withHouse('/scan/allocate'), icon: 'arrow-right', tint: 'tintGreen' },
    { label: 'Use an item', description: 'Scan a bottle or tool you used', path: withHouse('/scan/consume'), icon: 'box', tint: 'tintAmber' },
  ];

  const groups: LauncherGroup[] = [
    { title: 'Record', items: record },
    { title: 'Stock', items: stock },
  ];

  if (!isManager) return groups;

  stock.push(
    { label: 'Link items', description: 'Scan QR codes onto a delivery', path: '/link', icon: 'maximize', tint: 'tintGreen' },
    { label: 'Report discrepancy', description: "Stock doesn't match", path: withHouse('/adjust'), icon: 'clipboard', tint: 'tintAmber' },
    { label: 'Flag low stock', description: 'Raise a reorder signal', path: '/flag-stock', icon: 'flag', tint: 'tintAmber' },
  );

  groups.push({
    title: 'Manage',
    items: [
      { label: 'Assign a task', description: 'Put work on a dashboard', path: '/assign', icon: 'check-square', tint: 'tintGreen' },
      { label: 'Give points', description: 'Rate someone, plus or minus', path: '/score', icon: 'award', tint: 'tintAmber' },
      { label: 'Move birds', description: 'Between houses', path: '/transfer', icon: 'shuffle', tint: 'tintBlue' },
      { label: 'Feeding plan', description: 'Phases for a batch', path: '/feeding-program', icon: 'calendar', tint: 'tintGreen' },
      { label: 'Team', description: 'People, tasks and points', path: '/team', icon: 'users', tint: 'tintGreen' },
    ],
  });

  return groups;
}
