/**
 * Variable substitution for user-saved email templates (ticket #24).
 *
 * Tokens in template subject/body use {curlyBrace} syntax. Substitution is
 * intentionally LOOSE — unknown tokens are left as-is so reps can spot
 * unfilled fields before sending. Case-sensitive on purpose so {firstName}
 * and {firstname} don't both win.
 */

export interface TemplateContext {
  // Recipient (Contact)
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  title?: string | null;
  email?: string | null;
  // Recipient's company (Brand or Factory)
  company?: string | null;
  // Sender (current user)
  senderName?: string | null;
  senderEmail?: string | null;
  senderTitle?: string | null;
  // Free-form extras — anything passed here becomes {key} → value
  [extra: string]: string | null | undefined;
}

/**
 * Replace {token} occurrences in `text` using values from `ctx`. Missing or
 * empty values are left as the literal `{token}` so the rep can spot gaps.
 *
 * Auto-derives {fullName} from {firstName}+{lastName} when not explicitly set.
 */
export function applyTemplateVars(text: string, ctx: TemplateContext): string {
  if (!text) return text;
  const merged: TemplateContext = { ...ctx };
  if (!merged.fullName) {
    const fn = (merged.firstName || "").trim();
    const ln = (merged.lastName || "").trim();
    const composed = [fn, ln].filter(Boolean).join(" ");
    if (composed) merged.fullName = composed;
  }
  return text.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (match, key) => {
    const v = merged[key];
    if (v === undefined || v === null || v === "") return match;
    return String(v);
  });
}

/**
 * Returns the list of distinct {tokens} present in a template — useful for
 * pre-flight UI that warns "this template uses {company} but no company is
 * linked to this contact yet".
 */
export function listTemplateVars(text: string): string[] {
  if (!text) return [];
  const set = new Set<string>();
  const re = /\{([a-zA-Z][a-zA-Z0-9_]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) set.add(m[1]);
  return Array.from(set).sort();
}

/**
 * Apply substitution to both subject and body of a template. Returned object
 * preserves the input shape so callers can spread it directly into a compose
 * draft.
 */
export function renderTemplate(
  template: { subject: string; body: string },
  ctx: TemplateContext,
): { subject: string; body: string } {
  return {
    subject: applyTemplateVars(template.subject, ctx),
    body: applyTemplateVars(template.body, ctx),
  };
}
