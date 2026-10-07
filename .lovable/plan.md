# Extend your existing School ERP to match the master brief

## Comparison

The existing platform is a reusable core, not yet the complete system described in the upload. This comparison uses actual pages/server code and the live database inventory, not previous completion claims.

| Area | Already present | Still needed or incomplete |
|---|---|---|
| School setup | Multiple schools, codes, branding, sections and class arms | Campus hierarchy, structured sessions/terms, configurable school rules, module activation |
| People | Student registration, parent links, bulk import, promotion, staff role assignments | Admission applications/screening, full student timeline/documents, staff profiles, custom roles and permissions |
| Academics | Classes/subjects, daily student attendance, score entry, report cards and verification | Assigned-teacher restrictions, timetable, lesson plans, assignments, CBT, configurable assessments, approval/locking |
| Results | Current CA1 20 + CA2 20 + exam 60; section colours and watermark | School-specific grading, ranking toggle, competency assessment, reliable atomic publication and historical score snapshots |
| Parent portal | Children/switching, attendance, published reports, fees/receipts, alerts | Verified identity, assignments, timetable, documents, communication preferences |
| Finance | Fee items, invoices, payments, receipts and defaulter reminders | Restricted finance permissions, payment corrections/refunds, discounts, scholarships, expenses, gateways and payroll |
| Communication | Announcements, in-app notifications and Termii sending helper | Scheduled messages, delivery retries, templates, groups, email/push and event automation |
| Islamic education | Ordinary subjects can be named Arabic/Islamic Studies | First-class Tahfiz tracking, individual/group targets, revision/retention, riwayah and programme grading |
| Operations | Some health/biodata fields | Library, inventory/assets, transport, boarding, clinic visits and discipline workflows |
| Platform | Basic role dashboards, cloud storage and school RLS | Comprehensive audit trail, permission-aware search/exports, AI, offline sync, restore workflow and scale testing |

Only the homepage and sign-in page were browser smoke-tested during this comparison; private workflows and commercial-readiness are not yet verified.

## Important corrections before adding many modules

- Parent access currently trusts a phone number without verification. This does not satisfy the upload's family privacy requirement. Keep the current experience unchanged until a verification method is agreed; use OTP for real family records and retain easy access only for fictional demo data.
- Current database policies give all school staff broad result/payment powers. The role assignment rules in the interface are narrower than the database rules, so enforce boundaries in both places.
- A school code identifies an onboarding destination, not permission to access that school's records. Prevent users from changing their school affiliation to acquire access.
- Demo visitors share one school administrator identity and changes. Replace this with an isolated, restricted demo experience before opening more sensitive management actions.
- Result publishing currently writes individual cards and can count unsuccessful writes as successes. Make publication transactional, handle missing scores/tied ranks, and preserve published history.
- Existing server functions use privileged reads and several have top-level server-only imports. Correct boundaries incrementally rather than replacing working screens.

## Phase 1 — school controls and safe foundations

Build this first, then verify it before starting the next phase:

1. **School Settings:** provide school administrators access to their own branding, current session/term and supported section settings; super administrators select the school they manage.
2. **Module controls:** enable/disable implemented modules per school. Hide disabled modules in navigation and block their private actions. Do not show nonfunctional placeholders for future modules. Preserve existing enabled workflows by default.
3. **Permission foundation:** introduce school-scoped permissions and custom-role support alongside existing role assignments. Match current approved defaults: super administrators manage school administrators; school administrators manage teacher/accountant assignments. Prevent school admins from assigning/removing another school admin or elevating their own powers.
4. **Audit history:** append-only records for school settings, module changes and permission changes, readable only by authorized administrators. Extend coverage to academic and financial mutations when those modules are upgraded.
5. **Access corrections:** lock school affiliation changes to authorized administrators, restrict finance actions to approved roles, and correct server-only import boundaries in touched services.
6. **Verification:** test two-school isolation, unassigned-user denial, teacher/accountant boundaries, module disable/reenable behaviour, audit immutability and existing student/results/parent workflows. Include real signed-in browser checks and phone-sized layouts.

This phase does **not** claim to deliver all 32 modules. It establishes the controls the remaining additions depend on.

## Following phases

2. Student 360, admission pipeline, guardians, campuses and session enrollment history.
3. Teacher allocations, conflict-aware timetables, lessons, assignments/CBT, configurable assessment components and result approval.
4. Finance corrections, discounts/scholarships, expenses, verified gateway payments and HR/payroll.
5. Scheduled communication, delivery status/retries, notification preferences and document templates.
6. Tahfiz, Arabic and Islamic programmes with memorisation/revision analytics.
7. Inventory/assets, library, transport, boarding, health and discipline.
8. Permission-aware search/exports, expanded analytics and authorized AI assistant.
9. Offline synchronization, backup/recovery integration, performance tests and launch checks.

Each phase gets working pages, connected actions and tests; external integrations requiring credentials remain explicitly blocked, not labelled complete.

## Technical design

- Retain TanStack Start/React and Lovable Cloud PostgreSQL. Reuse existing screens, student/parent links, invoice/payment/report tables and semantic design tokens.
- Add school-scoped configuration/module tables and separate permission/custom-role tables; do not put roles on profiles. Add explicit GRANTs, RLS and indexes in every relevant migration.
- Use an authenticated server authorization helper plus RLS for every private read/mutation. UI visibility is not authorization. Persist audit entries through database triggers or transactional mutations.
- Model dependencies as: school → membership/permissions → module configuration → operational data → audit/analytics. Future campuses and enrollment history reference existing schools/classes/students rather than duplicating them.
- Introduce assessment components/scores additively later, with compatibility for existing 20/20/60 records. Never drop historic assessment columns before migration and report rendering are verified.
- Preserve nursery green, primary blue, secondary dark-purple templates and the school-logo watermark.
- Hosted provider backups are distinct from application exports. Do not offer a pretend restore button without a supported managed restore process.

## Delivery boundary

Approval starts Phase 1. Continue in verified phases, keeping a clear list of what is still missing. No production data deletion, mass rewrite, automatic email confirmation, or silent parent-login change.