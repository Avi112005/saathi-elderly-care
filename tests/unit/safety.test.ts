import { describe, expect, it } from "vitest";
import { identify, reviewMedications, smallestGapHours, findingsFor } from "@/lib/domain/safety";

const review = (meds: [string, string][], allergies = "", age: number | null = 70) =>
  reviewMedications(
    meds.map(([name, times]) => ({ name, times })),
    { allergies, age },
  );

describe("identify", () => {
  it("recognises generics, brands and combinations", () => {
    expect(identify("Ecosprin 75").generics).toContain("aspirin");
    expect(identify("Glycomet SR 500").generics).toEqual(["metformin"]);
    expect(identify("Combiflam").generics.sort()).toEqual(["ibuprofen", "paracetamol"]);
    expect(identify("Warfarin sodium").classes).toContain("anticoagulant");
  });

  it("matches whole words only", () => {
    expect(identify("Pantocid").generics).toEqual(["pantoprazole"]);
    expect(identify("Basalt").generics).toEqual([]); // contains "asa" but isn't aspirin
  });
});

describe("reviewMedications", () => {
  it("flags dangerous interactions as high severity", () => {
    const findings = review([
      ["Warfarin 5 mg", "20:00"],
      ["Brufen 400", "13:00"],
    ]);
    expect(findings[0]).toMatchObject({ severity: "high", kind: "interaction", title: "Serious bleeding risk" });
  });

  it("flags nitrates with sildenafil", () => {
    expect(
      review([
        ["Sorbitrate", "08:00"],
        ["Viagra", "21:00"],
      ]).some((f) => f.id.startsWith("pde5-nitrate")),
    ).toBe(true);
  });

  it("checks timing for absorption interactions", () => {
    const tooClose = review([
      ["Thyronorm 50", "06:30"],
      ["Shelcal 500", "08:30"],
    ]);
    expect(tooClose.find((f) => f.kind === "spacing")).toMatchObject({
      severity: "moderate",
      title: "Take at least 4 hours apart",
    });
    expect(tooClose.find((f) => f.kind === "spacing")!.detail).toContain("only 2 hours apart");

    const fine = review([
      ["Thyronorm 50", "06:30"],
      ["Shelcal 500", "13:00"],
    ]);
    expect(fine.find((f) => f.kind === "spacing")).toMatchObject({ severity: "info", title: "Timed correctly" });
  });

  it("detects allergy conflicts by class", () => {
    const findings = review([["Augmentin 625", "08:00,20:00"]], "Penicillin");
    expect(findings).toContainEqual(expect.objectContaining({ kind: "allergy", severity: "high" }));
  });

  it("detects duplicate therapy", () => {
    expect(
      review([
        ["Crocin", "08:00"],
        ["Dolo 650", "14:00"],
      ]).some((f) => f.kind === "duplicate"),
    ).toBe(true);
    expect(
      review([
        ["Omez", "08:00"],
        ["Pantocid", "08:00"],
      ]).some((f) => f.kind === "duplicate"),
    ).toBe(true);
  });

  it("applies Beers Criteria only from age 65", () => {
    expect(review([["Alprazolam 0.25", "22:00"]], "", 78).some((f) => f.kind === "senior")).toBe(true);
    expect(review([["Alprazolam 0.25", "22:00"]], "", 50).some((f) => f.kind === "senior")).toBe(false);
    expect(review([["Alprazolam 0.25", "22:00"]], "", null).some((f) => f.kind === "senior")).toBe(false);
  });

  it("returns nothing for a safe list and sorts by severity", () => {
    expect(
      review([
        ["Metformin 500", "08:00"],
        ["Amlodipine 5", "09:00"],
      ]),
    ).toEqual([]);
    const sorted = review([
      ["Warfarin", "20:00"],
      ["Ibuprofen", "13:00"],
      ["Omeprazole", "08:00"],
      ["Esomeprazole", "08:00"],
    ]);
    const order = sorted.map((f) => f.severity);
    expect(order).toEqual(
      [...order].sort((a, b) => ["high", "moderate", "info"].indexOf(a) - ["high", "moderate", "info"].indexOf(b)),
    );
  });

  it("filters findings for one medicine", () => {
    const findings = review([
      ["Warfarin", "20:00"],
      ["Ibuprofen", "13:00"],
      ["Metformin", "08:00"],
    ]);
    expect(findingsFor("Metformin", findings)).toEqual([]);
    expect(findingsFor("Warfarin", findings)).toHaveLength(1);
  });
});

describe("smallestGapHours", () => {
  it("wraps around midnight", () => {
    expect(smallestGapHours("23:00", "01:00")).toBe(2);
    expect(smallestGapHours("06:30", "08:30,20:00")).toBe(2);
    expect(smallestGapHours("", "08:00")).toBeNull();
  });
});
