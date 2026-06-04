
# Parent/Student Portal Plan

## Login (phone-only)
- Add a "Parent / Student" tab on `/auth` page. Single field: parent phone number.
- Submit calls a new public server route `POST /api/public/parent-login` that:
  - Normalises the phone, finds matching `parents` row, and on hit issues a signed short-lived JWT (stored in `localStorage` as `parent_token`) tied to `parent_id` + `school_id`.
  - No Supabase auth user is created (parents don't have email/password).
- New `useParentAuth()` hook + `/portal` route tree guarded by token presence.
- ⚠️ Security note for the user: anyone who knows a parent's phone can view that child's records. This is your choice; we'll document it in security memory. Recommend adding OTP later.

## Portal pages (`/portal/*`)
All read via new server fns that verify `parent_token` and scope queries by `parent_id`:
- `/portal` — child switcher (if multiple students linked), summary cards (next fee due, attendance %, latest report, unread notifications).
- `/portal/attendance` — calendar/table of daily attendance per child + monthly summary.
- `/portal/report-cards` — list of published report cards → links to existing `/report-card/$id` view (read-only).
- `/portal/fees` — open invoices, paid invoices, total balance; "Download receipt" PDF button per payment.
- `/portal/notifications` — newsletters, fee reminders, defaulter notices, admin messages.

## New database tables (one migration)
- `attendance(id, school_id, student_id, class_id, date, status[present|absent|late|excused], marked_by, note)` — unique on (student_id, date).
- `fee_items(id, school_id, name, amount, session, term, class_id nullable)` — fee catalog.
- `fee_invoices(id, school_id, student_id, fee_item_id, session, term, amount_due, amount_paid, status[unpaid|partial|paid|overdue], due_date)`.
- `fee_payments(id, school_id, invoice_id, student_id, amount, method, reference, paid_at, recorded_by, receipt_no auto-gen)`.
- `parent_notifications(id, school_id, parent_id, student_id nullable, type[news|fee_reminder|defaulter|message|general], title, body, read_at, created_by, created_at)`.
- All with RLS (school-scoped via existing `is_school_staff` / `get_user_school`) and GRANTs.
- A SQL function `create_fee_reminder_for_defaulters(school_id)` the accountant triggers.

## New staff/admin UIs
- **Teacher → Attendance** (`/attendance`): pick class + date, check-list to mark all students; bulk save.
- **Accountant → Fees** (`/fees`):
  - Manage fee items (CRUD).
  - Generate invoices for a class/term (bulk).
  - Record payment → auto-creates receipt + parent notification.
  - "Send reminders to defaulters" button → inserts `parent_notifications` rows of type `fee_reminder` for all unpaid past-due invoices.
- **Admin → Newsletter / Messages** (`/announcements`): compose, target all parents or a class, broadcasts into `parent_notifications` (type `news` or `message`).

## Receipt PDF
- Server fn `getReceiptPdf({payment_id})` generates a branded PDF (school name/logo, student, items, amount, receipt no., date) using `pdf-lib`. Returns bytes; client downloads.

## Notifications
- Portal bell shows unread count from `parent_notifications`.
- Existing Termii integration optionally fires SMS for `fee_reminder` and `news` (admin toggle per send).

## Sidebar / nav additions
- Add "Attendance" (teacher/admin), "Fees" (accountant/admin), "Announcements" (admin) to authenticated sidebar.
- `/portal/*` uses its own minimal layout (no admin sidebar) — phone-friendly tabs at bottom.

## Files (high level)
- Migration: `supabase/migrations/<ts>_portal.sql`
- New: `src/routes/_portal.tsx` (layout), `src/routes/_portal/{index,attendance,report-cards,fees,notifications}.tsx`, `src/routes/_portal/receipt.$id.tsx`
- New: `src/routes/_authenticated/{attendance,fees,announcements}.tsx`
- New server fns: `src/lib/api/{attendance,fees,announcements,portal}.functions.ts`
- New server route: `src/routes/api/public/parent-login.ts`
- New hook: `src/hooks/useParentAuth.ts`
- Edits: `src/routes/auth.tsx` (add Parent tab), `src/routes/_authenticated.tsx` (nav items), `src/integrations/supabase/types.ts` (regen after migration)

## Out of scope (confirm if you want any added)
- Online fee payment (Paystack/Stripe) — portal currently shows balances + receipts only.
- Student self-login (you chose single parent portal).
- SMS OTP for parent login (you chose phone-only).
