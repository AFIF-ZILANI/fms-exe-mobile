# Scan flows — allocate, consume, bind

Status: **Draft for review** (2026-10-07). Nothing here is built yet except Bind (`link.tsx`).

Written from the product discussion on 2026-10-07. Source of truth for the unit
model is `server/docs/inventory-tracking-design.md`; this doc only covers the
mobile side.

## 1. Why

Coded units (medicine, vaccine, equipment) carry a QR sticker. The server already
supports the whole lifecycle, but on mobile only the first step exists:

| Step | Server | Mobile today |
| --- | --- | --- |
| Provision + print blank codes | `POST /stock-units/provision` | Web only. Stays web only (desk job). |
| Bind code to purchase line | `POST /stock-units/:id/bind` | **Done** — `(manager)/link.tsx` |
| Allocate / move to a house | `POST /stock-units/:id/relocate` | **Missing** |
| Consume (use) | `POST /consumptions` with `stock_unit_id` | **Missing** — `log/consumption.tsx` filters to non-tracked items on purpose ("without QR in v1") |
| Mark consumed / disposed | `POST /stock-units/:id/dispose`, `PATCH status` | **Missing** — out of scope for this pass |

## 2. Unit lifecycle (as the code behaves today)

```
UNASSIGNED --bind--> IN_STOCK --first consumption--> IN_USE --manual--> CONSUMED
                         \______________ dispose ______________/--> DISPOSED
```

- Allocation (warehouse → house → house → warehouse) is a **separate event**
  (`StockHouseAllocation`: `ALLOCATION`, `REALLOCATION`, `RETURN`). It does **not**
  change status and does **not** create a Consumption.
- The first Consumption flips `IN_STOCK → IN_USE`. Later ones keep it `IN_USE`.
- `CONSUMED` is never set automatically any more (the quantity columns were removed
  from `StockUnit`). It is set by hand.
- **Whole-unit rule (decided 2026-10-07):** we do not track partial amounts. Using a
  coded unit means using the whole unit. No quantity entry on the scan screens.

## 3. Flow (same for all three actions)

1. Open the action page (Allocate, Consume, or Bind).
2. **Plan step** — set the target before scanning:
   - Allocate: destination house.
   - Consume: house (batch is resolved from the house, as the other log forms do).
   - Bind: purchase line (as today).
   - Optional "expect only this item" filter.
   - Mode toggle: **Manual confirm** or **Auto-confirm**.
3. Open the scanner and scan a QR. The app looks the unit up and shows a detail
   card: item, status, current house, purchase lot.
4. Mode decides what happens next:
   - **Manual confirm** — Confirm / Cancel on the card.
   - **Auto-confirm** — if the unit passes the checks it is confirmed immediately
     and added to the list. If it fails (wrong item, wrong status, already there)
     it stops and says why.
5. A running result list shows each scan as ok / error / cancelled. Writes go
   through the existing offline outbox.

## 4. Per-action rules

| Action | Request | Checks before confirm |
| --- | --- | --- |
| Allocate | `POST /stock-units/:id/relocate { house_id, idempotency_key }` | Not already at that house; matches item filter |
| Consume | `POST /consumptions { house_id, item_id, stock_unit_id, quantity, unit, date, batch_id }` | Status is `IN_STOCK` or `IN_USE`; unit's item equals the item |
| Bind | `POST /stock-units/:id/bind { purchase_item_id }` (exists) | Status is `UNASSIGNED` |

- Several allocations into one house in one session can share a `stock_transfer_id`
  so the stock ledger records one movement rather than one per unit.
- Allocate and Consume are worker actions (under `log/`). Bind stays manager-only.

## 5. Components

- **One shared scan session** extending `components/ui/qr-scanner.tsx`: plan step,
  scan step, detail card, result list. The three screens differ only in their plan
  fields and the request they send.
- **Decision logic is a pure module** next to `lib/scan.ts` (match / mismatch /
  duplicate / already-at-target), tested without a camera like `scan.test.ts`.
- Lookup: `GET /stock-units/:id` (the QR payload is the unit id).

## 6. Open items to settle in the plan

1. **Quantity and unit on a whole-unit consume. (Resolved 2026-10-07.)**
   A `StockUnit` is one pack of its `PurchaseItem`'s unit (`PurchaseItem.quantity` +
   `PurchaseItem.unit`, e.g. 12 BOTTLE). A whole-unit consume therefore sends
   `quantity: 1` and `unit: <purchase_item.unit>`. `toBaseQuantity` converts it with
   `ItemUnit.factor_to_base`. If the purchase unit equals `Item.unit` no conversion is
   needed; otherwise the item needs an `ItemUnit` row for that unit with
   `is_usable = true`, or the server rejects with "'X' is not a valid unit for using this
   item". The scan screen must show that message plainly. Do not send `item.unit` for a
   coded unit (that would mean 1 mL, not 1 bottle).
2. **Offline.** Bind requires a connection today because the checks are server-side.
   Decide per action whether Allocate / Consume may queue offline (the server's
   status checks would then run at sync time and a failure becomes a dead letter) or
   also require a connection.
3. **Task integration.** `lib/task-forms.ts` maps task types to screens. Decide
   whether "Consume" tasks route to the scan screen.
4. **Mark empty / dispose** by scan is deferred.

## 7. Testing

- Unit tests for the decision module (pure).
- Camera and haptics: verify on a real device or simulator; the web build cannot
  exercise them.
