import type { ContactMethod, CrawlResult } from "../types/index.js";
import type { LeadContactHint, LeadPriorityScore, LeadRouteDecision } from "./types.js";

export function normalizeContactMethods(input: {
  crawl?: CrawlResult;
  hints?: LeadContactHint[];
  fallbackUrl: string;
}): ContactMethod[] {
  const methods: ContactMethod[] = [];
  if (input.crawl?.contactEmail) {
    methods.push({ type: "email", value: input.crawl.contactEmail, sourceUrl: input.crawl.url, confidence: "high", label: "Public email" });
  }
  for (const method of input.crawl?.contactMethods ?? []) methods.push(method);
  for (const hint of input.hints ?? []) {
    methods.push({
      type: hint.type,
      value: hint.value,
      sourceUrl: hint.sourceUrl ?? input.fallbackUrl,
      confidence: hint.confidence ?? "medium",
      label: hint.label,
      reason: hint.reason,
    });
  }
  return rankContactMethods(dedupeContactMethods(methods));
}

export function rankContactMethods(methods: ContactMethod[]): ContactMethod[] {
  return [...methods].sort((a, b) => contactRank(b) - contactRank(a));
}

export function chooseLeadRoute(input: {
  contactMethods: ContactMethod[];
  priorityScore?: LeadPriorityScore;
  duplicateOrCooldown?: boolean;
  emailPolicyEnabled?: boolean;
  manualCapacityAvailable?: boolean;
}): LeadRouteDecision {
  if (input.duplicateOrCooldown) {
    return {
      route: "skip_duplicate",
      status: "skipped",
      reasonCode: "outreach_cooldown",
      message: "Lead is inside outreach cooldown window",
      priorityScore: input.priorityScore,
    };
  }
  const email = input.contactMethods.find((method) => method.type === "email");
  if (email && input.emailPolicyEnabled !== false) {
    return {
      route: "send_email",
      status: "ready",
      reasonCode: "email_available",
      message: "Email contact route is available",
      contactMethod: email,
      priorityScore: input.priorityScore,
    };
  }
  const form = input.contactMethods.find((method) => method.type === "form" || method.type === "contact_page");
  if (form) {
    return {
      route: "queue_contact_form",
      status: "queued",
      reasonCode: "form_available",
      message: "Contact form route is available",
      contactMethod: form,
      priorityScore: input.priorityScore,
    };
  }
  const dm = input.contactMethods.find((method) => method.type === "social_dm");
  if (dm) {
    return {
      route: "queue_social_dm",
      status: "queued",
      reasonCode: "social_dm_available",
      message: "Social DM route is available",
      contactMethod: dm,
      priorityScore: input.priorityScore,
    };
  }
  const manual = input.contactMethods.find((method) => method.type === "phone" || method.type === "maps_profile" || method.type === "manual");
  return {
    route: input.manualCapacityAvailable === false ? "hold_policy_blocked" : "queue_manual_follow_up",
    status: input.manualCapacityAvailable === false ? "held" : "queued",
    reasonCode: manual ? "manual_contact_available" : "contact_unknown",
    message: manual ? "Manual follow-up route is available" : "No supported contact method was found",
    contactMethod: manual,
    priorityScore: input.priorityScore,
  };
}

function dedupeContactMethods(methods: ContactMethod[]): ContactMethod[] {
  const seen = new Set<string>();
  return methods.flatMap((method) => {
    if (!method.value) return [];
    const key = `${method.type}:${method.value.toLowerCase()}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [method];
  });
}

function contactRank(method: ContactMethod): number {
  const typeRank: Record<ContactMethod["type"], number> = {
    email: 70,
    form: 60,
    contact_page: 55,
    social_dm: 45,
    phone: 35,
    maps_profile: 25,
    manual: 10,
  };
  const confidenceRank = method.confidence === "high" ? 3 : method.confidence === "medium" ? 2 : 1;
  return typeRank[method.type] + confidenceRank;
}

