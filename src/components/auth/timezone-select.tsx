"use client";

import { useEffect, useState } from "react";
import { SelectField } from "@/components/ui/form";

/** Time-zone picker that defaults to the browser's zone after hydration. */
export function TimezoneSelect({ zones, defaultValue = "Asia/Kolkata", errors, name = "timezone" }: { zones: string[]; defaultValue?: string; errors?: string[]; name?: string }) {
  const [value, setValue] = useState(defaultValue);
  useEffect(() => {
    if (defaultValue !== "Asia/Kolkata") return;
    const browser = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // One-time sync with a browser-only value that the server cannot know.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (browser && zones.includes(browser)) setValue(browser);
  }, [defaultValue, zones]);
  return (
    <SelectField
      label="Time zone"
      name={name}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      options={zones.map((z) => ({ value: z, label: z.replace(/_/g, " ") }))}
      hint="Doses are scheduled in the elder's local time, even if family live elsewhere."
      errors={errors}
    />
  );
}
