// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";

// Server actions are replaced with stubs: these tests are about markup and behaviour.
vi.mock("@/app/actions/medications", () => ({ logDose: vi.fn(), undoDoseAction: vi.fn(), saveMedication: vi.fn(), addStock: vi.fn(), stopMedication: vi.fn() }));

import { DoseCard, type DoseCardData } from "@/components/app/dose-card";
import { QuickCheck } from "@/components/landing/quick-check";
import { FormMessage, TextField } from "@/components/ui/form";
import { ProgressRing } from "@/components/ui/primitives";

async function expectNoAxeViolations(container: HTMLElement) {
  // jsdom can't compute rendered colours, so contrast is checked by the Playwright + axe
  // suite in a real browser instead. `region` doesn't apply to isolated components.
  const results = await axe.run(container, { rules: { region: { enabled: false }, "color-contrast": { enabled: false } } });
  const summary = results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
  expect(summary).toEqual([]);
}

const dose: DoseCardData = {
  medicationId: "m1",
  scheduledFor: "2026-03-10T02:30:00.000Z",
  timeLabel: "8:00 AM",
  state: "PENDING",
  name: "Metformin",
  strength: "500 mg",
  doseLabel: "1 tablet",
  foodLabel: "With food",
  instructions: "",
  appearance: "White oblong tablet",
  pillColor: "white",
  purpose: "Diabetes",
  loggedBy: null,
  actedLabel: null,
  note: "",
  canLog: true,
  canAct: true,
};

describe("DoseCard", () => {
  it("is accessible and offers large Taken / Skip actions", async () => {
    const { container } = render(<DoseCard dose={dose} />);
    expect(screen.getByRole("article", { name: /Metformin/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Taken" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Skip" })).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it("asks for a reason before skipping", async () => {
    render(<DoseCard dose={dose} />);
    await userEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(screen.getByLabelText("Why skip this dose?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Confirm skip" })).toBeInTheDocument();
  });

  it("shows who logged a taken dose and offers undo", () => {
    render(<DoseCard dose={{ ...dose, state: "TAKEN", loggedBy: "Priya", actedLabel: "8:05 AM" }} />);
    expect(screen.getByText(/Taken at 8:05 AM · Priya/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
  });

  it("offers late confirmation for missed doses and hides actions for read-only viewers", () => {
    const { rerender } = render(<DoseCard dose={{ ...dose, state: "MISSED" }} />);
    expect(screen.getByRole("button", { name: "Taken (late)" })).toBeInTheDocument();
    rerender(<DoseCard dose={{ ...dose, canAct: false }} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("form primitives", () => {
  it("links labels, hints and errors for screen readers", async () => {
    const { container } = render(<TextField label="Medicine name" name="name" hint="As on the strip" errors={["Medicine name is required"]} required />);
    const input = screen.getByLabelText(/Medicine name/);
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Medicine name is required");
    await expectNoAxeViolations(container);
  });

  it("announces errors assertively and success politely", () => {
    const { rerender } = render(<FormMessage state={{ status: "error", message: "Check your PIN" }} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Check your PIN");
    rerender(<FormMessage state={{ status: "success", message: "Saved" }} />);
    expect(screen.getByRole("status")).toHaveTextContent("Saved");
  });

  it("gives the progress ring a text alternative", async () => {
    const { container } = render(<ProgressRing value={86} label="86% of doses taken" />);
    expect(screen.getByRole("img", { name: "86% of doses taken" })).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });
});

describe("QuickCheck", () => {
  it("is a keyboard-operable radio group with live feedback", async () => {
    const { container } = render(<QuickCheck />);
    const options = screen.getAllByRole("radio");
    expect(options).toHaveLength(3);
    await userEvent.click(options[1]!);
    expect(options[1]).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText(/Right\./)).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });
});
