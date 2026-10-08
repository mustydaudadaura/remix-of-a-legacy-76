export const SCHOOL_MODULES = [
  { id: 'students', name: 'Students & parents' },
  { id: 'academics', name: 'Classes & subjects' },
  { id: 'promotion', name: 'Session promotion' },
  { id: 'results', name: 'Results & report cards' },
  { id: 'attendance', name: 'Attendance' },
  { id: 'fees', name: 'Fees & payments' },
  { id: 'communication', name: 'Announcements & messages' },
] as const;
export const SCHOOL_PERMISSIONS = [
  'students.view', 'students.edit', 'academics.view', 'academics.edit',
  'promotion.edit', 'results.view', 'results.edit', 'results.publish',
  'attendance.view', 'attendance.edit', 'fees.view', 'fees.edit',
  'communication.view', 'communication.edit', 'settings.edit', 'users.edit', 'audit.view',
  'staffatt.view', 'staffatt.edit', 'staffatt.kiosk', 'payroll.view', 'payroll.edit', 'payroll.approve',
] as const;
export type SchoolPermission = typeof SCHOOL_PERMISSIONS[number];
export const ACTIVE_SCHOOL_KEY = 'eduerp_active_school';
export function selectSchool(id: string) {
  localStorage.setItem(ACTIVE_SCHOOL_KEY, id);
  window.dispatchEvent(new Event('school-selection'));
}