// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import axe from "axe-core";
import { foodTimingLabel, oneOf, toDoseStatus, toFoodTiming } from "@/lib/domain/types";
import { toRoutineKind, toVitalFlag } from "@/lib/domain/vitals";
import { DaysField, TimesField } from "@/components/app/schedule-fields";

describe("stored-value guards", () => {
  it("accept known values and fall back safely on anything else", () => {
    expect(oneOf(["A", "B"] as const, "B", "A")).toBe("B");
    expect(oneOf(["A", "B"] as const, "Z", "A")).toBe("A");
    expect(oneOf(["A", "B"] as const, null, "A")).toBe("A");
    expect(toFoodTiming("WITH_FOOD")).toBe("WITH_FOOD");
    expect(toFoodTiming("<script>")).toBe("ANY");
    expect(toDoseStatus("TAKEN")).toBe("TAKEN");
    expect(toRoutineKind("BLOOD_SUGAR")).toBe("BLOOD_SUGAR");
    expect(toRoutineKind("UNKNOWN")).toBe("ACTIVITY");
    expect(toVitalFlag(undefined)).toBe("NORMAL");
  });

  it("labels food timing for people, hiding 'any time'", () => {
    expect(foodTimingLabel("WITH_FOOD")).toBe("With food");
    expect(foodTimingLabel("ANY")).toBe("");
    expect(foodTimingLabel("nonsense")).toBe("");
  });
});

function Harness({ max = 3 }: { max?: number }) {
  const [times, setTimes] = useState(["08:00"]);
  const [days, setDays] = useState([1, 3]);
  return (
    <form aria-label="schedule">
      <TimesField label="Times" itemLabel="Dose time" times={times} onChange={setTimes} max={max} />
      <DaysField days={days} onChange={setDays} />
      <output data-testid="state">{`${times.join(",")}|${days.join(",")}`}</output>
    </form>
  );
}

describe("shared schedule fields", () => {
  it("adds and removes times up to the limit", async () => {
    render(<Harness max={2} />);
    await userEvent.click(screen.getByRole("button", { name: /Add a time/ }));
    expect(screen.getByTestId("state")).toHaveTextContent("08:00,12:00|1,3");
    expect(screen.queryByRole("button", { name: /Add a time/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Remove time 1" }));
    expect(screen.getByTestId("state")).toHaveTextContent("12:00|1,3");
    expect(screen.queryByRole("button", { name: /Remove time/ })).not.toBeInTheDocument();
  });

  it("toggles weekdays and keeps them in numeric order", async () => {
    render(<Harness />);
    await userEvent.click(screen.getByLabelText("Tue"));
    expect(screen.getByTestId("state")).toHaveTextContent("|1,2,3");
    await userEvent.click(screen.getByLabelText("Mon"));
    expect(screen.getByTestId("state")).toHaveTextContent("|2,3");
  });

  it("submits the same field names the server actions expect and is accessible", async () => {
    vi.useRealTimers();
    const { container } = render(<Harness />);
    const data = new FormData(container.querySelector("form")!);
    expect(data.getAll("times")).toEqual(["08:00"]);
    expect(data.getAll("daysOfWeek")).toEqual(["1", "3"]);
    const results = await axe.run(container, {
      rules: { region: { enabled: false }, "color-contrast": { enabled: false } },
    });
    expect(results.violations.map((v) => v.id)).toEqual([]);
  });
});
