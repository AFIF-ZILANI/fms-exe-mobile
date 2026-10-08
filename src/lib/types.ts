/**
 * Shared shapes mirroring server Prisma models (server/prisma/schema.prisma).
 * Grown as each screen needs a new one -- not a full client-side schema mirror.
 */

export type EmployeeRole = 'MANAGER' | 'WORKER' | 'INTERN';

export type Profile = {
  id: string;
  name: string;
  mobile: string;
  email?: string | null;
  is_active: boolean;
  address?: string | null;
  avatar?: { image_url: string } | null;
};

export type MaritalStatus = 'SINGLE' | 'MARRIED' | 'DIVORCED' | 'WIDOWED';
export type EmploymentStatus = 'APPOINTED' | 'PROBATION' | 'CONFIRMED' | 'TERMINATED';

export type Employee = {
  id: string;
  profile_id: string;
  role: EmployeeRole;
  salary: string; // Decimal -> JSON string
  joining_date: string;
  rating: number | null;
  profile: Profile;
  // Hire profile (GET /employees/:id). Optional: older rows predate it.
  date_of_birth?: string | null;
  marital_status?: MaritalStatus | null;
  education?: string | null;
  experience?: string | null;
  experience_years?: number | null;
  nid_number?: string | null;
  emergency_name?: string | null;
  emergency_relation?: string | null;
  emergency_phone?: string | null;
  employment_status?: EmploymentStatus;
  probation_end_date?: string | null;
};

export type House = {
  id: string;
  name: string;
  type: 'BROODER' | 'GROWER' | 'LAYER';
  number: number;
  capacity: number | null;
  is_active: boolean;
};

export type Batch = {
  id: string;
  batch_code: string;
  breed: string;
  phase: 'BROODER' | 'GROWER';
  status: 'RUNNING' | 'CLOSED' | 'SOLD';
  starting_date: string;
  expected_selling_date: string;
  initial_chick_count: number;
};

export type BatchHouseBalance = {
  id: string;
  batch_id: string;
  house_id: string;
  quantity: number;
  updated_at: string;
  batch?: Batch;
  house?: House;
};

export type Item = {
  id: string;
  name: string;
  category: string;
  unit: string;
  is_unit_tracked: boolean;
  is_active: boolean;
  /** Decimal as a string; null/absent = no reorder level set. */
  reorder_level?: string | null;
};

export type TaskType = {
  id: string;
  code: string;
  label: string;
  is_active: boolean;
};

export type Task = {
  id: string;
  code: string;
  label: string;
  task_type_id: string | null;
  task_type: TaskType | null;
  is_active: boolean;
};

export type ScoreEntry = {
  id: string;
  employee_id: string;
  given_by_id: string;
  criterion: string;
  points: number;
  reason: string;
  date: string;
  /** Included by the server so the history can name who gave the entry --
   *  given_by_id is any Profile, so this can be an Admin, not just an
   *  Employee. */
  given_by?: { id: string; name: string; role: string };
};

export type PayrollRecord = {
  id: string;
  employee_id: string;
  month: string;
  baseline_salary: string;
  score_sum: number;
  adjustment_percent: string;
  final_salary: string;
};

export type Warehouse = {
  id: string;
  name: string;
};

/** GET /items/stock-by-location -- the computed running balance per
 *  (item, location). `balance` is a Decimal serialized as a string. */
export type StockByLocation = {
  item_id: string;
  location_type: 'WAREHOUSE' | 'HOUSE';
  location_id: string;
  location_name: string;
  balance: string;
};

export type Purchase = {
  id: string;
  supplier_id: string;
  purchase_date: string;
};

export type PurchaseItem = {
  id: string;
  purchase_id: string;
  item_id: string;
  /** The unit this line was bought in (e.g. BOTTLE). A coded StockUnit is one of these. */
  unit: string;
  base_quantity: string;
  item: Item;
  purchase: Purchase;
};

export type StockUnitStatus = 'UNASSIGNED' | 'IN_STOCK' | 'IN_USE' | 'CONSUMED' | 'DISPOSED';

export type StockUnit = {
  id: string;
  purchase_item_id: string | null;
  status: StockUnitStatus;
  bound_at: string | null;
  bound_by_id: string | null;
  /** Present on GET /stock-units/:id and the list (server withRelations). */
  purchase_item?: { id: string; item_id: string; unit: string; item: Item } | null;
  /** Newest first, at most one: the latest allocation is the unit's current location. */
  houseAllocations?: { house_id: string | null; house?: { id: string; name: string } | null }[];
};

export type Doctor = {
  id: string;
  profile_id: string;
  specialty: string | null;
  profile: Profile;
};

export type TaskAssignmentStatus = 'PENDING' | 'DONE' | 'CANCELLED';

export type TaskAssignment = {
  id: string;
  employee_id: string;
  assigned_by_id: string;
  task_id: string;
  title: string;
  description: string | null;
  house_id: string | null;
  location_note: string | null;
  due_at: string;
  status: TaskAssignmentStatus;
  completed_at: string | null;
  completion_note: string | null;
  task: Task;
  employee: Employee;
  house: House | null;
};

export type AlertLevel = 'INFO' | 'WARNING' | 'CRITICAL';

/** GET /alerts rows. Named FarmAlert so it never collides with React Native's `Alert`. */
export type FarmAlert = {
  id: string;
  title: string;
  description: string | null;
  type: 'EMPLOYEE' | 'BATCH' | 'FEED' | 'MEDICINE' | 'SYSTEM';
  level: AlertLevel;
  status: 'ACTIVE' | 'RESOLVED';
  issued_at: string;
  resolved_at: string | null;
  created_at: string;
};
