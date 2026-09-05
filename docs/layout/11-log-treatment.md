# 11 · Log Treatment

**Route:** `src/app/log/treatment.tsx` · **Tier:** Both · **Tab bar:** hidden

Uses the shared log-form spine specified in
[07 · Log mortality](07-log-mortality.md#the-shared-spine).

One screen, **two endpoints** — medication and vaccination.

---

## Purpose

Record what was given to the flock, what dose, and why.

---

## Frame

```
┌────────────────────────────────────────┐
│  ✕   Log treatment                     │
├────────────────────────────────────────┤
│  ( Medication )      ( Vaccination )   │  Type toggle  48h  ↕16
│                                        │
│  HOUSE                                 │
│ ┌────────────────────────────────────┐ │
│ │ House 2                         ▾  │ │  52h
│ └────────────────────────────────────┘ │
│ ┌────────────────────────────────────┐ │
│ │ B-24 · Cobb 500 · d21              │ │  64h  tintGreen
│ │ 4,812 live birds                   │ │
│ └────────────────────────────────────┘ │
│                                        │
│  MEDICATION NAME                       │
│ ┌────────────────────────────────────┐ │
│ │ Amoxicillin                        │ │  52h
│ └────────────────────────────────────┘ │
│                                        │
│  DOSAGE                                │
│ ┌────────────────────────────────────┐ │
│ │ 1 g per litre, 5 days              │ │  52h
│ └────────────────────────────────────┘ │
│                                        │
│  CAUSE (OPTIONAL)                      │
│ ┌────────────────────────────────────┐ │
│ │ Respiratory signs in 40 birds      │ │  88h
│ └────────────────────────────────────┘ │
│                                        │
│  DOCTOR (OPTIONAL)                     │
│ ┌────────────────────────────────────┐ │
│ │ Dr. Anwar                          │ │  52h
│ └────────────────────────────────────┘ │
│                                        │
│  REMARKS (OPTIONAL)                    │
│ ┌────────────────────────────────────┐ │
│ │                                    │ │  88h
│ └────────────────────────────────────┘ │
│                                        │
│  DATE                                  │
│ ┌────────────────────────────────────┐ │
│ │ Today · 6 Sep 2026              ▾  │ │  52h
│ └────────────────────────────────────┘ │
├────────────────────────────────────────┤
│  ▉▉▉  Record medication          ▉▉▉  │
└────────────────────────────────────────┘
```

---

## Anatomy

### Type toggle — `<SegmentedToggle>` `48h`

| Element | Spec |
| --- | --- |
| Position | **Above the house picker** — the first thing on the form, because it changes what every field below is called and which endpoint receives the write |
| Container | `48h` (taller than the standard 44 — this is a consequential switch, not a filter), `pill` radius, `surfaceAlt`, 3dp inner padding, full width |
| Segments | Two equal, `42h`. Active: `surface` fill, `card` elevation, `label` `ink`. Inactive: `label` `muted`. |
| Default | Medication, or from `?type=` when deep-linked from the log sheet or a task |
| Switching | Preserves house, date and any shared field values. It does **not** clear the form — a worker who picked the wrong type shouldn't retype the house. |

### Fields — labels change with the type

| Field | Medication label | Vaccination label | Control | Required |
| --- | --- | --- | --- | --- |
| Name | "MEDICATION NAME" | "VACCINE NAME" | `<TextField>` `52h` | Yes |
| Dosage | "DOSAGE" | "DOSE" | `<TextField>` `52h` | Yes |
| Cause | "CAUSE (OPTIONAL)" | "REASON (OPTIONAL)" | `<TextField>` `88h` | No |
| Doctor | "DOCTOR (OPTIONAL)" | "DOCTOR (OPTIONAL)" | `<TextField>` `52h` | No |
| Remarks | "REMARKS (OPTIONAL)" | "REMARKS (OPTIONAL)" | `<TextField>` `88h` | No |
| Date | "DATE" | "DATE" | `<PickerField>` `52h` | Yes, defaults today |

- Name is **focused on mount** when a house arrived prefilled.
- Dosage is free text on purpose — "1 g per litre, 5 days" is how it's written on
  the bottle and how a vet says it. A structured amount + unit + duration triple
  would be more queryable and would be filled in wrong.
- **Doctor is optional and stays optional.** Treatments happen without one, and a
  required field here produces "N/A" in every row within a week.

### Submit bar

"Record medication" / "Record vaccination". The label doesn't compose a value —
there's no single figure worth surfacing, and "Record Amoxicillin" reads oddly.

---

## States

| State | Treatment |
| --- | --- |
| **Loading** | Per the spine. The type toggle renders live. |
| **Empty — no batch** | Spine's `tintRed` resolver, submit disabled. |
| **Stale** | Spine treatment. |
| **Error** | Field-level per the spine. Name and dosage are the only two that can fail validation. |
| **Offline** | No change. |

---

## Interactions

| Target | Size | Action |
| --- | --- | --- |
| Type segment | `42h` in a `48h` bar | Switch type, relabel fields, preserve values |
| Name / Dosage / Doctor | `52h` | Focus, default keyboard |
| Cause / Remarks | `88h` | Focus, multiline |
| Date field | `52h` | Platform date picker, `maximumDate` today |
| Submit | `52h` | Queue to the matching endpoint → toast → pop |

---

## Data

| Endpoint | Use |
| --- | --- |
| `GET /batch-house-balances?house_id=X` | Batch resolver |
| `POST /medications` | Write, when type = Medication |
| `POST /vaccinations` | Write, when type = Vaccination |

`administered_by_id` from the session.

---

## Notes

- **One screen, two endpoints.** The toggle picks the endpoint at enqueue time,
  and the queued item records which one — switching the toggle after a write is
  queued must not redirect the queued row.
- The two record shapes are close enough that two screens would be duplication,
  and different enough that one unlabelled screen would be confusing. The toggle
  is the seam, and it sits above everything else so it's never missed.
- **Deep-linked from a task**, `?type=medication` or `?type=vaccination` comes
  from `TASK_FORMS`, which maps `MEDICATION` and `VACCINATION` to this one route
  with different query strings.
- This is the least-used log form. It gets no quick-log tile on house detail and
  sits last in the log sheet — both correct, and neither should be "fixed" by
  promoting it.
