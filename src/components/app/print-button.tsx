"use client";

import { Button } from "@/components/ui/primitives";

export function PrintButton() {
  return (
    <Button type="button" icon="printer" onClick={() => window.print()}>
      Print or save as PDF
    </Button>
  );
}
