import { clockToMinutes } from "./time";
import { parseTimes } from "./schedule";

/**
 * Senior Safety Check — a curated, offline knowledge base that flags well-documented
 * risks for older adults: major drug–drug interactions, allergy conflicts, duplicate
 * therapy, timing conflicts, and AGS Beers Criteria® medicines that are potentially
 * inappropriate after 65.
 *
 * It is a prompt to talk to a pharmacist or doctor, never a replacement for one.
 */

export type Severity = "high" | "moderate" | "info";
export type FindingKind = "interaction" | "allergy" | "senior" | "duplicate" | "spacing";

export interface SafetyFinding {
  id: string;
  severity: Severity;
  kind: FindingKind;
  title: string;
  detail: string;
  medications: string[];
}

/** generic → brand names and alternative spellings, including common Indian brands. */
const ALIASES: Record<string, string[]> = {
  aspirin: ["ecosprin", "disprin", "acetylsalicylic acid", "asa", "loprin"],
  warfarin: ["coumadin", "warf", "uniwarfin"],
  acenocoumarol: ["acitrom", "sintrom"],
  apixaban: ["eliquis"],
  rivaroxaban: ["xarelto"],
  dabigatran: ["pradaxa"],
  clopidogrel: ["plavix", "clopilet", "deplatt"],
  ticagrelor: ["brilinta", "axcer"],
  ibuprofen: ["brufen", "advil", "motrin", "combiflam"],
  naproxen: ["naprosyn", "aleve"],
  diclofenac: ["voveran", "voltaren", "dynapar"],
  aceclofenac: ["zerodol", "hifenac"],
  etoricoxib: ["etoshine", "arcoxia"],
  celecoxib: ["celebrex"],
  ketorolac: ["toradol", "ketorol"],
  paracetamol: ["acetaminophen", "crocin", "dolo", "calpol", "tylenol"],
  omeprazole: ["omez", "prilosec"],
  esomeprazole: ["nexium", "nexpro"],
  pantoprazole: ["pantocid", "pan 40", "pantop", "protonix"],
  rabeprazole: ["razo", "rablet"],
  metformin: ["glycomet", "glucophage", "obimet"],
  glibenclamide: ["glyburide", "daonil", "euglucon"],
  glimepiride: ["amaryl", "glimy"],
  gliclazide: ["diamicron", "glizid"],
  amlodipine: ["amlong", "norvasc", "stamlo", "amlopres"],
  lisinopril: ["zestril", "listril"],
  enalapril: ["envas", "vasotec"],
  ramipril: ["cardace", "altace"],
  perindopril: ["coversyl"],
  losartan: ["cozaar", "losar", "repace"],
  telmisartan: ["telma", "micardis"],
  valsartan: ["diovan", "valzaar"],
  olmesartan: ["olmezest", "benicar"],
  spironolactone: ["aldactone"],
  eplerenone: ["inspra"],
  amiloride: ["midamor"],
  "potassium chloride": ["potklor", "k-dur", "klor-con"],
  atorvastatin: ["lipitor", "atorva", "storvas"],
  simvastatin: ["zocor", "simvotin"],
  lovastatin: ["mevacor"],
  rosuvastatin: ["crestor", "rosuvas"],
  clarithromycin: ["claribid", "biaxin"],
  erythromycin: ["erythrocin"],
  levothyroxine: ["thyronorm", "eltroxin", "synthroid", "thyrox", "euthyrox"],
  "calcium carbonate": ["shelcal", "caltrate", "calcium", "cipcal", "calcimax"],
  "ferrous sulfate": ["iron", "ferrous", "fefol", "livogen", "autrin"],
  antacid: ["gelusil", "digene", "mucaine", "tums", "aluminium hydroxide", "magnesium hydroxide"],
  digoxin: ["lanoxin"],
  amiodarone: ["cordarone", "tachyra"],
  sildenafil: ["viagra", "penegra"],
  tadalafil: ["cialis", "tadacip"],
  "isosorbide mononitrate": ["isosorbide", "monotrate", "imdur", "sorbitrate", "isosorbide dinitrate"],
  nitroglycerin: ["glyceryl trinitrate", "nitrocontin", "gtn"],
  sertraline: ["zoloft", "serta", "daxid"],
  escitalopram: ["lexapro", "nexito", "cipralex"],
  fluoxetine: ["prozac", "fludac"],
  paroxetine: ["paxil", "pexep"],
  citalopram: ["celexa"],
  tramadol: ["ultram", "ultracet", "contramal"],
  oxycodone: ["oxycontin"],
  morphine: ["ms contin"],
  codeine: ["codeine phosphate"],
  tapentadol: ["tapal", "nucynta"],
  alprazolam: ["xanax", "alprax", "restyl"],
  diazepam: ["valium", "calmpose"],
  lorazepam: ["ativan"],
  clonazepam: ["klonopin", "rivotril", "clonotril"],
  zolpidem: ["ambien", "zolfresh", "stilnoct"],
  diphenhydramine: ["benadryl"],
  chlorpheniramine: ["chlorphenamine", "piriton", "cetrizet d"],
  hydroxyzine: ["atarax"],
  promethazine: ["phenergan"],
  amitriptyline: ["tryptomer", "elavil"],
  cyclobenzaprine: ["flexeril"],
  chlorzoxazone: ["myospaz", "parafon"],
  methocarbamol: ["robaxin"],
  lithium: ["lithosun", "licab"],
  methotrexate: ["folitrax", "trexall"],
  trimethoprim: ["co-trimoxazole", "cotrimoxazole", "bactrim", "septran", "sulfamethoxazole"],
  ciprofloxacin: ["ciplox", "cipro"],
  levofloxacin: ["levaquin", "levoflox", "tavanic"],
  alendronate: ["fosamax", "osteofos"],
  allopurinol: ["zyloric", "zyloprim"],
  azathioprine: ["imuran", "azoran"],
  prednisolone: ["wysolone", "omnacortil", "prednisone"],
  dexamethasone: ["decadron", "dexona"],
  amoxicillin: ["mox", "novamox", "augmentin", "amoxyclav", "clavam"],
  ampicillin: ["ampilox"],
  penicillin: ["penicillin v", "penidure"],
};

/** generic → therapeutic classes. */
const CLASSES: Record<string, string[]> = {
  aspirin: ["antiplatelet", "nsaid-aspirin", "salicylate"],
  warfarin: ["anticoagulant"],
  acenocoumarol: ["anticoagulant"],
  apixaban: ["anticoagulant"],
  rivaroxaban: ["anticoagulant"],
  dabigatran: ["anticoagulant"],
  clopidogrel: ["antiplatelet"],
  ticagrelor: ["antiplatelet"],
  ibuprofen: ["nsaid"],
  naproxen: ["nsaid"],
  diclofenac: ["nsaid"],
  aceclofenac: ["nsaid"],
  etoricoxib: ["nsaid"],
  celecoxib: ["nsaid"],
  ketorolac: ["nsaid"],
  omeprazole: ["ppi", "cyp2c19-inhibitor"],
  esomeprazole: ["ppi", "cyp2c19-inhibitor"],
  pantoprazole: ["ppi"],
  rabeprazole: ["ppi"],
  glibenclamide: ["sulfonylurea"],
  glimepiride: ["sulfonylurea"],
  gliclazide: ["sulfonylurea"],
  lisinopril: ["ace-inhibitor"],
  enalapril: ["ace-inhibitor"],
  ramipril: ["ace-inhibitor"],
  perindopril: ["ace-inhibitor"],
  losartan: ["arb"],
  telmisartan: ["arb"],
  valsartan: ["arb"],
  olmesartan: ["arb"],
  spironolactone: ["potassium-raising"],
  eplerenone: ["potassium-raising"],
  amiloride: ["potassium-raising"],
  "potassium chloride": ["potassium-raising"],
  atorvastatin: ["statin"],
  simvastatin: ["statin", "statin-cyp3a4"],
  lovastatin: ["statin", "statin-cyp3a4"],
  rosuvastatin: ["statin"],
  clarithromycin: ["strong-cyp3a4-inhibitor"],
  erythromycin: ["strong-cyp3a4-inhibitor"],
  levothyroxine: ["thyroid-hormone"],
  "calcium carbonate": ["binding-mineral"],
  "ferrous sulfate": ["binding-mineral"],
  antacid: ["binding-mineral"],
  sildenafil: ["pde5-inhibitor"],
  tadalafil: ["pde5-inhibitor"],
  "isosorbide mononitrate": ["nitrate"],
  nitroglycerin: ["nitrate"],
  sertraline: ["ssri"],
  escitalopram: ["ssri"],
  fluoxetine: ["ssri"],
  paroxetine: ["ssri", "anticholinergic"],
  citalopram: ["ssri"],
  tramadol: ["opioid", "serotonergic-opioid"],
  oxycodone: ["opioid"],
  morphine: ["opioid"],
  codeine: ["opioid"],
  tapentadol: ["opioid", "serotonergic-opioid"],
  alprazolam: ["benzodiazepine"],
  diazepam: ["benzodiazepine"],
  lorazepam: ["benzodiazepine"],
  clonazepam: ["benzodiazepine"],
  zolpidem: ["z-drug"],
  diphenhydramine: ["anticholinergic", "first-gen-antihistamine"],
  chlorpheniramine: ["anticholinergic", "first-gen-antihistamine"],
  hydroxyzine: ["anticholinergic", "first-gen-antihistamine"],
  promethazine: ["anticholinergic", "first-gen-antihistamine"],
  amitriptyline: ["anticholinergic", "tricyclic"],
  cyclobenzaprine: ["muscle-relaxant"],
  chlorzoxazone: ["muscle-relaxant"],
  methocarbamol: ["muscle-relaxant"],
  ciprofloxacin: ["quinolone"],
  levofloxacin: ["quinolone"],
  prednisolone: ["corticosteroid"],
  dexamethasone: ["corticosteroid"],
  amoxicillin: ["penicillin"],
  ampicillin: ["penicillin"],
  penicillin: ["penicillin"],
  trimethoprim: ["sulfa"],
};

interface InteractionRule {
  id: string;
  a: string;
  b: string;
  severity: Severity;
  title: string;
  detail: string;
  /** For absorption interactions: the minimum hours between the two doses. */
  separateByHours?: number;
}

/** `a` and `b` are generic names or class names. */
const INTERACTIONS: InteractionRule[] = [
  { id: "bleed-anticoag-nsaid", a: "anticoagulant", b: "nsaid", severity: "high", title: "Serious bleeding risk", detail: "A blood thinner with a painkiller like ibuprofen or diclofenac greatly raises the risk of stomach and internal bleeding. Paracetamol is usually the safer painkiller — ask the doctor." },
  { id: "bleed-anticoag-antiplatelet", a: "anticoagulant", b: "antiplatelet", severity: "high", title: "Two blood thinners together", detail: "An anticoagulant plus an antiplatelet (e.g. aspirin, clopidogrel) raises bleeding risk. This is sometimes intended after a heart procedure — confirm it with the prescribing doctor." },
  { id: "clopi-ppi", a: "clopidogrel", b: "cyp2c19-inhibitor", severity: "moderate", title: "Acid medicine may weaken clopidogrel", detail: "Omeprazole and esomeprazole reduce how well clopidogrel protects the heart. Pantoprazole is usually preferred — ask the doctor." },
  { id: "k-acei", a: "ace-inhibitor", b: "potassium-raising", severity: "high", title: "Potassium can rise dangerously", detail: "This blood-pressure medicine plus spironolactone or potassium supplements can push potassium to dangerous levels. Regular blood tests are needed." },
  { id: "k-arb", a: "arb", b: "potassium-raising", severity: "high", title: "Potassium can rise dangerously", detail: "This blood-pressure medicine plus spironolactone or potassium supplements can push potassium to dangerous levels. Regular blood tests are needed." },
  { id: "kidney-acei-nsaid", a: "ace-inhibitor", b: "nsaid", severity: "moderate", title: "Kidney strain", detail: "Painkillers like ibuprofen can reduce kidney function and blunt blood-pressure control when taken with this medicine, especially in older adults." },
  { id: "kidney-arb-nsaid", a: "arb", b: "nsaid", severity: "moderate", title: "Kidney strain", detail: "Painkillers like ibuprofen can reduce kidney function and blunt blood-pressure control when taken with this medicine, especially in older adults." },
  { id: "pde5-nitrate", a: "pde5-inhibitor", b: "nitrate", severity: "high", title: "Do not combine — sudden low blood pressure", detail: "Sildenafil or tadalafil with a nitrate (for chest pain) can cause a dangerous drop in blood pressure. This combination must be avoided." },
  { id: "serotonin", a: "ssri", b: "serotonergic-opioid", severity: "high", title: "Serotonin syndrome risk", detail: "This antidepressant with tramadol or tapentadol can cause agitation, fever, tremor and seizures. Watch closely and tell the doctor." },
  { id: "benzo-opioid", a: "benzodiazepine", b: "opioid", severity: "high", title: "Breathing can slow dangerously", detail: "A sedative with an opioid painkiller can cause extreme drowsiness and slowed breathing. Regulators carry their strongest warning on this pair." },
  { id: "statin-macrolide", a: "statin-cyp3a4", b: "strong-cyp3a4-inhibitor", severity: "high", title: "Muscle damage risk", detail: "Clarithromycin or erythromycin can raise simvastatin/lovastatin levels sharply, risking serious muscle damage. The statin is often paused during the antibiotic course." },
  { id: "digoxin-amio", a: "digoxin", b: "amiodarone", severity: "high", title: "Digoxin levels can become toxic", detail: "Amiodarone raises digoxin levels. The digoxin dose usually needs lowering and blood levels checking." },
  { id: "lithium-nsaid", a: "lithium", b: "nsaid", severity: "high", title: "Lithium can build up", detail: "Painkillers like ibuprofen reduce lithium clearance and can cause toxicity (shaking, confusion, vomiting)." },
  { id: "mtx-tmp", a: "methotrexate", b: "trimethoprim", severity: "high", title: "Bone-marrow suppression risk", detail: "Co-trimoxazole/trimethoprim with methotrexate can dangerously lower blood counts." },
  { id: "allo-aza", a: "allopurinol", b: "azathioprine", severity: "high", title: "Azathioprine levels rise", detail: "Allopurinol blocks azathioprine breakdown; the azathioprine dose normally has to be cut sharply." },
  { id: "ssri-nsaid", a: "ssri", b: "nsaid", severity: "moderate", title: "Stomach bleeding risk", detail: "This antidepressant plus an anti-inflammatory painkiller increases the risk of stomach bleeding. A stomach-protecting medicine may be advised." },
  { id: "steroid-nsaid", a: "corticosteroid", b: "nsaid", severity: "moderate", title: "Stomach ulcer risk", detail: "Steroids and anti-inflammatory painkillers together raise the risk of ulcers and bleeding." },
  { id: "thyroid-mineral", a: "thyroid-hormone", b: "binding-mineral", severity: "moderate", title: "Take at least 4 hours apart", detail: "Calcium, iron and antacids stop levothyroxine being absorbed. Levothyroxine works best alone on an empty stomach, with these minerals at least 4 hours later.", separateByHours: 4 },
  { id: "quinolone-mineral", a: "quinolone", b: "binding-mineral", severity: "moderate", title: "Separate the doses", detail: "Calcium, iron and antacids block this antibiotic. Take the antibiotic at least 2 hours before (or 6 hours after) them.", separateByHours: 2 },
];

interface SeniorRule {
  className: string;
  title: string;
  detail: string;
  severity: Severity;
}

/** Selected AGS Beers Criteria® (2023) guidance for adults aged 65+. */
const SENIOR_RULES: SeniorRule[] = [
  { className: "first-gen-antihistamine", severity: "moderate", title: "Potentially inappropriate after 65", detail: "Older antihistamines cause confusion, constipation, dry mouth and falls in older adults. Newer options (e.g. cetirizine, loratadine) are usually safer." },
  { className: "tricyclic", severity: "moderate", title: "Potentially inappropriate after 65", detail: "Amitriptyline is strongly anticholinergic and sedating, raising the risk of confusion and falls." },
  { className: "benzodiazepine", severity: "moderate", title: "Raises fall and confusion risk", detail: "Sedatives increase the risk of memory problems, falls and hip fractures in older adults. Ask about tapering slowly — never stop suddenly." },
  { className: "z-drug", severity: "moderate", title: "Raises fall risk", detail: "Sleeping tablets like zolpidem increase falls and fractures with little added sleep benefit in older adults." },
  { className: "sulfonylurea", severity: "moderate", title: "Low blood sugar risk", detail: "Sulfonylureas can cause prolonged low blood sugar in older adults. Watch for sweating, shakiness or confusion, especially if meals are skipped." },
  { className: "muscle-relaxant", severity: "moderate", title: "Potentially inappropriate after 65", detail: "Muscle relaxants are poorly tolerated by older adults (drowsiness, falls) and are of questionable benefit." },
  { className: "nsaid", severity: "info", title: "Use for the shortest time possible", detail: "Regular anti-inflammatory painkillers raise the risk of stomach bleeding and kidney problems after 65." },
  { className: "ppi", severity: "info", title: "Review if used for more than 8 weeks", detail: "Long-term acid medicines are linked to bone loss and infections. Ask whether it is still needed." },
];

/** Allergy words a family might type → the classes and generics they cover. */
const ALLERGY_TERMS: Record<string, string[]> = {
  penicillin: ["penicillin"],
  amoxicillin: ["penicillin"],
  sulfa: ["sulfa"],
  sulpha: ["sulfa"],
  sulfonamide: ["sulfa"],
  nsaid: ["nsaid", "nsaid-aspirin"],
  nsaids: ["nsaid", "nsaid-aspirin"],
  aspirin: ["salicylate"],
  ibuprofen: ["ibuprofen"],
  codeine: ["codeine"],
  morphine: ["morphine"],
  opioid: ["opioid"],
  statin: ["statin"],
};

export interface Identified {
  generics: string[];
  classes: string[];
}

function normalise(text: string): string {
  return ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()} `;
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
      const DUPLICATE_CLASSES = ["nsaid", "ppi", "ssri", "benzodiazepine", "statin", "ace-inhibitor", "arb", "anticoagulant", "sulfonylurea"];
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
