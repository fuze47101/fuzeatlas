export type EntityType = "BRAND" | "FACTORY" | "DISTRIBUTOR";
export type CheckinKind = "NONE" | "UPDATE" | "SUPER" | "HELP";

export interface BookAccount {
  entityType: EntityType;
  entityId: string;
  name: string;
  country: string | null;
  stage: string | null;
  forecastQuarter: string | null;
  galaLead: boolean;
  primaryContact: string | null;
  isPrimary: boolean;
  lastCheckinAt: string | null;
  lastCheckinKind: CheckinKind | null;
  lastRealTouchAt: string | null;
  lastNote: string | null;
  nextStep: string | null;
  nextStepAt: string | null;
  silentWeeks: number;
  checkedInThisWeek: boolean;
  openHelp: number;
  attention: "ok" | "amber" | "red";
}

export interface HelpItem {
  id: string;
  entityType: EntityType;
  entityId: string;
  ask: string;
  status: string;
  dueAt: string;
  createdAt: string;
  escalatedAt?: string | null;
  requester: { id: string; name: string };
  assignee: { id: string; name: string };
}

export interface TeamUser {
  id: string;
  name: string;
  email: string;
  role: string;
  distributorId?: string | null;
}

export const STAGES = [
  "LEAD",
  "PRESENTATION",
  "BRAND_TESTING",
  "FACTORY_ONBOARDING",
  "FACTORY_TESTING",
  "PRODUCTION",
  "BRAND_EXPANSION",
  "CUSTOMER_WON",
  "ARCHIVE",
];

export function quarters(): string[] {
  const now = new Date();
  const out: string[] = [];
  let y = now.getFullYear(),
    q = Math.floor(now.getMonth() / 3) + 1;
  for (let i = 0; i < 8; i++) {
    out.push(`${y} Q${q}`);
    q++;
    if (q > 4) {
      q = 1;
      y++;
    }
  }
  return out;
}

export function ago(iso: string | null | undefined): string {
  if (!iso) return "never";
  const d = (Date.now() - new Date(iso).getTime()) / 86400000;
  if (d < 1) return "today";
  if (d < 2) return "yesterday";
  if (d < 14) return `${Math.floor(d)}d ago`;
  if (d < 60) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

export function stageLabel(s: string | null): string {
  if (!s) return "";
  return s
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
