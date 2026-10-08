/** Placeholders families see filled in: {parent_name}, {school_name}. */
export const TEMPLATE_PLACEHOLDERS = ["parent_name", "school_name"] as const;

export function fillTemplate(text: string, vars: Partial<Record<(typeof TEMPLATE_PLACEHOLDERS)[number], string>>): string {
  return text.replace(/\{(parent_name|school_name)\}/g, (_, k: keyof typeof vars) => vars[k]?.trim() || (k === "parent_name" ? "Parent" : ""));
}

/** Only newsletters and general notices may be muted; fee reminders and direct messages always arrive. */
export const MUTABLE_TYPES = ["news", "general"] as const;
export function isMuted(type: string, muted: string[] | null | undefined): boolean {
  return (MUTABLE_TYPES as readonly string[]).includes(type) && (muted ?? []).includes(type);
}
