import { clockToMinutes } from "./time";
import { parseTimes } from "./schedule";
import { ALIASES, ALLERGY_TERMS, CLASSES, INTERACTIONS, SENIOR_RULES, type Severity } from "./safety-data";

export type { Severity };

/**
 * Senior Safety Check — a curated, offline knowledge base that flags well-documented
 * risks for older adults: major drug–drug interactions, allergy conflicts, duplicate
 * therapy, timing conflicts, and AGS Beers Criteria® medicines that are potentially
 * inappropriate after 65.
 *
 * It is a prompt to talk to a pharmacist or doctor, never a replacement for one.
 */

export type FindingKind = "interaction" | "allergy" | "senior" | "duplicate" | "spacing";

export interface SafetyFinding {
  id: string;
  severity: Severity;
  kind: FindingKind;
  title: string;
  detail: string;
  medications: string[];
}

export interface Identified {
  generics: string[];
  classes: string[];
}

function normalise(text: string): string {
  return ` ${text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()} `;
}

function mentions(haystack: string, needle: string): boolean {
  return haystack.includes(normalise(needle));
}

/** Works out which generic medicines (and their classes) a free-text name refers to. */
export function identify(name: string): Identified {
  const text = normalise(name);
  const generics = new Set<string>();
  for (const [generic, aliases] of Object.entries(ALIASES)) {
    if (mentions(text, generic) || aliases.some((a) => mentions(text, a))) generics.add(generic);
  }
  // Brand combinations: Combiflam is ibuprofen + paracetamol, Ultracet is tramadol + paracetamol.
  if (mentions(text, "combiflam") || mentions(text, "ultracet")) generics.add("paracetamol");
  const classes = new Set<string>();
  for (const g of generics) for (const c of CLASSES[g] ?? []) classes.add(c);
  return { generics: [...generics], classes: [...classes] };
}

function matchesTerm(id: Identified, term: string): boolean {
  return id.generics.includes(term) || id.classes.includes(term);
}

export interface ReviewMedication {
  name: string;
  times: string;
}

/** Smallest gap, in hours, between any dose of `a` and any dose of `b` across a day. */
export function smallestGapHours(timesA: string, timesB: string): number | null {
  const a = parseTimes(timesA).map(clockToMinutes);
  const b = parseTimes(timesB).map(clockToMinutes);
  if (a.length === 0 || b.length === 0) return null;
  let best = Infinity;
  for (const x of a) {
    for (const y of b) {
      const diff = Math.abs(x - y);
      best = Math.min(best, diff, 1440 - diff);
    }
  }
  return best / 60;
}

/** Classes where two different medicines usually mean the same therapy prescribed twice. */
const DUPLICATE_CLASSES: readonly string[] = [
  "nsaid",
  "ppi",
  "ssri",
  "benzodiazepine",
  "statin",
  "ace-inhibitor",
  "arb",
  "anticoagulant",
  "sulfonylurea",
];

const SEVERITY_ORDER: Record<Severity, number> = { high: 0, moderate: 1, info: 2 };

/**
 * Reviews a full medication list. `age` enables the Beers checks (65+), `allergies`
 * is the free-text allergy field from the care profile.
 */
export function reviewMedications(
  meds: ReviewMedication[],
  context: { allergies: string; age: number | null },
): SafetyFinding[] {
  const findings: SafetyFinding[] = [];
  const identified = meds.map((m) => ({ med: m, id: identify(m.name) }));

  // Pairwise interactions and duplicates.
  for (let i = 0; i < identified.length; i++) {
    for (let j = i + 1; j < identified.length; j++) {
      const x = identified[i]!;
      const y = identified[j]!;
      for (const rule of INTERACTIONS) {
        const forward = matchesTerm(x.id, rule.a) && matchesTerm(y.id, rule.b);
        const backward = matchesTerm(x.id, rule.b) && matchesTerm(y.id, rule.a);
        if (!forward && !backward) continue;
        if (rule.separateByHours !== undefined) {
          const gap = smallestGapHours(x.med.times, y.med.times);
          if (gap !== null && gap >= rule.separateByHours) {
            findings.push({
              id: `${rule.id}:${x.med.name}:${y.med.name}`,
              severity: "info",
              kind: "spacing",
              title: "Timed correctly",
              detail: `${x.med.name} and ${y.med.name} are scheduled at least ${rule.separateByHours} hours apart, which is what they need.`,
              medications: [x.med.name, y.med.name],
            });
            continue;
          }
          findings.push({
            id: `${rule.id}:${x.med.name}:${y.med.name}`,
            severity: rule.severity,
            kind: "spacing",
            title: rule.title,
            detail: `${rule.detail}${gap !== null ? ` They are currently only ${formatHours(gap)} apart.` : ""}`,
            medications: [x.med.name, y.med.name],
          });
          continue;
        }
        findings.push({
          id: `${rule.id}:${x.med.name}:${y.med.name}`,
          severity: rule.severity,
          kind: "interaction",
          title: rule.title,
          detail: rule.detail,
          medications: [x.med.name, y.med.name],
        });
      }

      const sharedGeneric = x.id.generics.find((g) => y.id.generics.includes(g));
      const sharedClass = x.id.classes.find((c) => DUPLICATE_CLASSES.includes(c) && y.id.classes.includes(c));
      if (sharedGeneric || sharedClass) {
        findings.push({
          id: `duplicate:${x.med.name}:${y.med.name}`,
          severity: "moderate",
          kind: "duplicate",
          title: "Possible duplicate medicine",
          detail: sharedGeneric
            ? `Both contain ${sharedGeneric}. Taking both could double the dose.`
            : `Both are in the same family of medicines (${sharedClass}). Check that both are really meant to be taken.`,
          medications: [x.med.name, y.med.name],
        });
      }
    }
  }

  // Allergies.
  const allergyText = normalise(context.allergies);
  for (const { med, id } of identified) {
    for (const [term, covers] of Object.entries(ALLERGY_TERMS)) {
      if (!mentions(allergyText, term)) continue;
      if (covers.some((c) => matchesTerm(id, c))) {
        findings.push({
          id: `allergy:${term}:${med.name}`,
          severity: "high",
          kind: "allergy",
          title: `Listed allergy: ${term}`,
          detail: `${med.name} may belong to a group this person is allergic to. Check with the doctor or pharmacist before the next dose.`,
          medications: [med.name],
        });
      }
    }
    for (const generic of id.generics) {
      if (mentions(allergyText, generic) && !Object.keys(ALLERGY_TERMS).includes(generic)) {
        findings.push({
          id: `allergy:${generic}:${med.name}`,
          severity: "high",
          kind: "allergy",
          title: `Listed allergy: ${generic}`,
          detail: `${med.name} contains ${generic}, which is listed as an allergy.`,
          medications: [med.name],
        });
      }
    }
  }

  // Beers Criteria for 65+.
  if (context.age !== null && context.age >= 65) {
    for (const { med, id } of identified) {
      const rule = SENIOR_RULES.find((r) => id.classes.includes(r.className));
      if (rule) {
        findings.push({
          id: `senior:${rule.className}:${med.name}`,
          severity: rule.severity,
          kind: "senior",
          title: rule.title,
          detail: rule.detail,
          medications: [med.name],
        });
      }
    }
  }

  const unique = new Map(findings.map((f) => [f.id, f]));
  return [...unique.values()].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} minutes`;
  const rounded = Math.round(hours * 10) / 10;
  return `${rounded} hour${rounded === 1 ? "" : "s"}`;
}

/** Findings that involve one particular medicine — used to warn while a form is filled in. */
export function findingsFor(name: string, findings: SafetyFinding[]): SafetyFinding[] {
  return findings.filter((f) => f.medications.includes(name));
}

export const SAFETY_DISCLAIMER =
  "Saathi's safety check uses a curated list of well-known risks. It cannot know everything about this person — always confirm with a doctor or pharmacist, and never stop a medicine without advice.";
