/** A batch's disease case, as GET /disease-cases returns it (the fields the app uses). */
export type DiseaseCase = {
  id: string;
  status: 'ACTIVE' | 'RESOLVED';
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  noticed_on: string;
  disease: { id: string; label: string };
  houses: { id: string; name: string }[];
};

/** The open cases a death in this house can be put down to -- an outbreak elsewhere on the farm isn't one. */
export function openCasesIn(cases: DiseaseCase[], houseId: string | undefined): DiseaseCase[] {
  if (!houseId) return [];
  return cases.filter((c) => c.status === 'ACTIVE' && c.houses.some((h) => h.id === houseId));
}
