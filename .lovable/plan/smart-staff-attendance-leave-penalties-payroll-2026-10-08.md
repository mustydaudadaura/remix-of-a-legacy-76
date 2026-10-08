# Smart Staff Attendance, Leave, Penalties & Payroll

Added as a new module. Existing pages (Students, Fees/Payroll, Attendance for pupils, Settings) keep working. It reuses the current staff accounts, school roles, the audit trail and the existing payroll tables, so no duplicate staff records are created.

## What the school will get

1. **My Attendance (every staff member)**: big screen showing name, today's status and one large CHECK IN / CHECK OUT button. The phone's location is checked against the school's approved area. Outside the area it shows: "Attendance action denied. You are outside the approved school location."
2. **Kiosk Mode**: a tablet at the entrance. Staff type a 4-digit PIN and see only their name, photo and today's status, then check in or out. The screen clears itself after 8 seconds. Each school decides whether the tablet also needs GPS.
3. **Staff Attendance dashboard (admins)**: totals for present, absent, late, on leave, currently in, checked out and missing check-outs. Charts by day, week and month, plus late and absence trends. Filters for date, department, staff category, staff member and status.
4. **Leave & Exemptions**: school and public holidays, events, leave types (annual, sick, official assignment, permission), leave requests with approval, and individual exemptions. Exempt days never count as absent or carry a penalty, and the reason is shown.
5. **Penalties**: configurable rules for lateness (per occurrence or after X minutes), absence, early departure and missing check-out. Penalties are only recorded at first. Payroll deducts them only when the payroll rule says so. Staff cannot waive their own penalties. Admins can waive with a reason.
6. **Payroll periods**: monthly, weekly or custom. Each staff line shows basic pay, days present/absent, lates, penalties, allowances, deductions, gross, total deductions and net. Status moves Draft → Reviewed → Approved → Paid. The preview never changes salary records. Approval needs payroll permission. Corrections create a new version that is recorded in the audit trail.
7. **Staff history**: per-staff table (Date, In, Out, Hours, Status, Late, Penalty, Location check) with search and filters. Admin corrections require a reason and are logged.
8. **Reports**: daily, weekly, monthly, summary, late, absence, leave/exemption, penalty, payroll and individual. Each can be printed to PDF or downloaded as Excel/CSV.
9. **Settings**: reporting time, grace period, closing time, minimum hours, late and early-departure thresholds, school coordinates and radius, GPS on/off for phones and kiosk, penalty amounts, salary type (monthly or weekly), and leave approval rules.
10. **Roles**: Super admin and school admin get full control. A new **Chief Reporting Officer** permission can view attendance and reports but not settings or pay. Staff see only their own records and leave. Kiosk can only check people in and out.

## Navigation

Inside the existing sidebar: My Attendance, Staff Attendance, Leave & Exemptions, Penalties, Payroll (the existing Fees → Payroll tab moves here and keeps its data), Staff Reports, Kiosk.

## Edge cases handled

Double taps and network retries (one record per staff per day, and requests carry a unique key). Check-out before check-in is blocked. A forgotten check-out is auto-flagged after closing time. GPS unavailable or denied gives a clear message and the action is refused. Offline taps are refused with a "No internet" message instead of being stored silently. Holidays, leave and exemptions override absence. Salary changes take effect from a set date, so old payroll is untouched. Department transfers are kept with dates.

## Technical details

- New tables (all school-scoped with RLS, grants and audit triggers): `staff_profiles` (user_id, staff_no, department, category, photo, kiosk PIN hash, salary type, active), `staff_department_history`, `attendance_settings` (one row per school: times, thresholds, lat/lng, radius, GPS flags, penalty rule JSON), `staff_attendance` (unique school+user+date, check_in/out timestamps, lat/lng/accuracy/distance, verified flags, method phone|kiosk|admin, computed status, late_minutes, hours, idempotency key), `holidays`, `leave_types`, `leave_requests`, `attendance_exemptions`, `staff_penalties`, `payroll_periods`, `payroll_records`, `payroll_items`. The existing `staff_salary_settings` gets `salary_type` and `effective_from` columns. Existing `staff_salaries` rows stay readable as history.
- Check-in/out goes through authenticated server functions only. The server takes the time, computes the distance (haversine) and status, and writes using an admin client after the permission check. Clients get no insert or update rights on `staff_attendance`, so staff cannot edit their own records.
- Kiosk: a kiosk device signs in with a dedicated kiosk role account. A server function checks the PIN hash (with rate limiting and a lockout after 5 tries) and returns only name, photo and status.
- New permissions in `SCHOOL_PERMISSIONS`: `staff_attendance.view/edit`, `payroll.view/approve`, `reports.view` (for the Chief Reporting Officer). These are checked through `school_permission()` in policies and server functions.
- Status, penalty and payroll maths live in one shared browser-safe module (`src/lib/staff-attendance.ts`, `src/lib/payroll-calc.ts`) used by the server and the screens. Each rule gets unit tests: grace boundary 7:45, exemption overrides absence, penalty applies only when enabled, net = gross + allowances − penalties − deductions.
- Audit: the existing `capture_school_audit()` trigger is attached to every new table.
- Delivered in 3 steps, each verified in the demo school: (A) database, settings, my attendance, GPS, kiosk; (B) leave, exemptions, penalties, dashboard, history; (C) payroll periods, reports and exports, roles. Then a final end-to-end test.
