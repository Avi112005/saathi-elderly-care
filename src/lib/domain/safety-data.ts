/**
 * Knowledge base for the Senior Safety Check: medicine names (generic + common brands),
 * therapeutic classes, interaction rules, Beers Criteria® cautions and allergy terms.
 * Kept separate from the checking logic in `safety.ts` so clinical content can be
 * reviewed and extended without touching code paths.
 */

export type Severity = "high" | "moderate" | "info";

/** generic → brand names and alternative spellings, including common Indian brands. */
export const ALIASES: Record<string, string[]> = {
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
export const CLASSES: Record<string, string[]> = {
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

export interface InteractionRule {
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
export const INTERACTIONS: InteractionRule[] = [
  {
    id: "bleed-anticoag-nsaid",
    a: "anticoagulant",
    b: "nsaid",
    severity: "high",
    title: "Serious bleeding risk",
    detail:
      "A blood thinner with a painkiller like ibuprofen or diclofenac greatly raises the risk of stomach and internal bleeding. Paracetamol is usually the safer painkiller — ask the doctor.",
  },
  {
    id: "bleed-anticoag-antiplatelet",
    a: "anticoagulant",
    b: "antiplatelet",
    severity: "high",
    title: "Two blood thinners together",
    detail:
      "An anticoagulant plus an antiplatelet (e.g. aspirin, clopidogrel) raises bleeding risk. This is sometimes intended after a heart procedure — confirm it with the prescribing doctor.",
  },
  {
    id: "clopi-ppi",
    a: "clopidogrel",
    b: "cyp2c19-inhibitor",
    severity: "moderate",
    title: "Acid medicine may weaken clopidogrel",
    detail:
      "Omeprazole and esomeprazole reduce how well clopidogrel protects the heart. Pantoprazole is usually preferred — ask the doctor.",
  },
  {
    id: "k-acei",
    a: "ace-inhibitor",
    b: "potassium-raising",
    severity: "high",
    title: "Potassium can rise dangerously",
    detail:
      "This blood-pressure medicine plus spironolactone or potassium supplements can push potassium to dangerous levels. Regular blood tests are needed.",
  },
  {
    id: "k-arb",
    a: "arb",
    b: "potassium-raising",
    severity: "high",
    title: "Potassium can rise dangerously",
    detail:
      "This blood-pressure medicine plus spironolactone or potassium supplements can push potassium to dangerous levels. Regular blood tests are needed.",
  },
  {
    id: "kidney-acei-nsaid",
    a: "ace-inhibitor",
    b: "nsaid",
    severity: "moderate",
    title: "Kidney strain",
    detail:
      "Painkillers like ibuprofen can reduce kidney function and blunt blood-pressure control when taken with this medicine, especially in older adults.",
  },
  {
    id: "kidney-arb-nsaid",
    a: "arb",
    b: "nsaid",
    severity: "moderate",
    title: "Kidney strain",
    detail:
      "Painkillers like ibuprofen can reduce kidney function and blunt blood-pressure control when taken with this medicine, especially in older adults.",
  },
  {
    id: "pde5-nitrate",
    a: "pde5-inhibitor",
    b: "nitrate",
    severity: "high",
    title: "Do not combine — sudden low blood pressure",
    detail:
      "Sildenafil or tadalafil with a nitrate (for chest pain) can cause a dangerous drop in blood pressure. This combination must be avoided.",
  },
  {
    id: "serotonin",
    a: "ssri",
    b: "serotonergic-opioid",
    severity: "high",
    title: "Serotonin syndrome risk",
    detail:
      "This antidepressant with tramadol or tapentadol can cause agitation, fever, tremor and seizures. Watch closely and tell the doctor.",
  },
  {
    id: "benzo-opioid",
    a: "benzodiazepine",
    b: "opioid",
    severity: "high",
    title: "Breathing can slow dangerously",
    detail:
      "A sedative with an opioid painkiller can cause extreme drowsiness and slowed breathing. Regulators carry their strongest warning on this pair.",
  },
  {
    id: "statin-macrolide",
    a: "statin-cyp3a4",
    b: "strong-cyp3a4-inhibitor",
    severity: "high",
    title: "Muscle damage risk",
    detail:
      "Clarithromycin or erythromycin can raise simvastatin/lovastatin levels sharply, risking serious muscle damage. The statin is often paused during the antibiotic course.",
  },
  {
    id: "digoxin-amio",
    a: "digoxin",
    b: "amiodarone",
    severity: "high",
    title: "Digoxin levels can become toxic",
    detail: "Amiodarone raises digoxin levels. The digoxin dose usually needs lowering and blood levels checking.",
  },
  {
    id: "lithium-nsaid",
    a: "lithium",
    b: "nsaid",
    severity: "high",
    title: "Lithium can build up",
    detail:
      "Painkillers like ibuprofen reduce lithium clearance and can cause toxicity (shaking, confusion, vomiting).",
  },
  {
    id: "mtx-tmp",
    a: "methotrexate",
    b: "trimethoprim",
    severity: "high",
    title: "Bone-marrow suppression risk",
    detail: "Co-trimoxazole/trimethoprim with methotrexate can dangerously lower blood counts.",
  },
  {
    id: "allo-aza",
    a: "allopurinol",
    b: "azathioprine",
    severity: "high",
    title: "Azathioprine levels rise",
    detail: "Allopurinol blocks azathioprine breakdown; the azathioprine dose normally has to be cut sharply.",
  },
  {
    id: "ssri-nsaid",
    a: "ssri",
    b: "nsaid",
    severity: "moderate",
    title: "Stomach bleeding risk",
    detail:
      "This antidepressant plus an anti-inflammatory painkiller increases the risk of stomach bleeding. A stomach-protecting medicine may be advised.",
  },
  {
    id: "steroid-nsaid",
    a: "corticosteroid",
    b: "nsaid",
    severity: "moderate",
    title: "Stomach ulcer risk",
    detail: "Steroids and anti-inflammatory painkillers together raise the risk of ulcers and bleeding.",
  },
  {
    id: "thyroid-mineral",
    a: "thyroid-hormone",
    b: "binding-mineral",
    severity: "moderate",
    title: "Take at least 4 hours apart",
    detail:
      "Calcium, iron and antacids stop levothyroxine being absorbed. Levothyroxine works best alone on an empty stomach, with these minerals at least 4 hours later.",
    separateByHours: 4,
  },
  {
    id: "quinolone-mineral",
    a: "quinolone",
    b: "binding-mineral",
    severity: "moderate",
    title: "Separate the doses",
    detail:
      "Calcium, iron and antacids block this antibiotic. Take the antibiotic at least 2 hours before (or 6 hours after) them.",
    separateByHours: 2,
  },
];

export interface SeniorRule {
  className: string;
  title: string;
  detail: string;
  severity: Severity;
}

/** Selected AGS Beers Criteria® (2023) guidance for adults aged 65+. */
export const SENIOR_RULES: SeniorRule[] = [
  {
    className: "first-gen-antihistamine",
    severity: "moderate",
    title: "Potentially inappropriate after 65",
    detail:
      "Older antihistamines cause confusion, constipation, dry mouth and falls in older adults. Newer options (e.g. cetirizine, loratadine) are usually safer.",
  },
  {
    className: "tricyclic",
    severity: "moderate",
    title: "Potentially inappropriate after 65",
    detail: "Amitriptyline is strongly anticholinergic and sedating, raising the risk of confusion and falls.",
  },
  {
    className: "benzodiazepine",
    severity: "moderate",
    title: "Raises fall and confusion risk",
    detail:
      "Sedatives increase the risk of memory problems, falls and hip fractures in older adults. Ask about tapering slowly — never stop suddenly.",
  },
  {
    className: "z-drug",
    severity: "moderate",
    title: "Raises fall risk",
    detail:
      "Sleeping tablets like zolpidem increase falls and fractures with little added sleep benefit in older adults.",
  },
  {
    className: "sulfonylurea",
    severity: "moderate",
    title: "Low blood sugar risk",
    detail:
      "Sulfonylureas can cause prolonged low blood sugar in older adults. Watch for sweating, shakiness or confusion, especially if meals are skipped.",
  },
  {
    className: "muscle-relaxant",
    severity: "moderate",
    title: "Potentially inappropriate after 65",
    detail:
      "Muscle relaxants are poorly tolerated by older adults (drowsiness, falls) and are of questionable benefit.",
  },
  {
    className: "nsaid",
    severity: "info",
    title: "Use for the shortest time possible",
    detail: "Regular anti-inflammatory painkillers raise the risk of stomach bleeding and kidney problems after 65.",
  },
  {
    className: "ppi",
    severity: "info",
    title: "Review if used for more than 8 weeks",
    detail: "Long-term acid medicines are linked to bone loss and infections. Ask whether it is still needed.",
  },
];

/** Allergy words a family might type → the classes and generics they cover. */
export const ALLERGY_TERMS: Record<string, string[]> = {
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
