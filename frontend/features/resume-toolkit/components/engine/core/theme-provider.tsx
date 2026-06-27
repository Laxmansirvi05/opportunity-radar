import React from "react";
import { Design } from "@/features/resume-toolkit/lib/schema/resume/data";

interface ThemeProviderProps {
  design?: Design;
  children: React.ReactNode;
}

export function ThemeProvider({ design, children }: ThemeProviderProps) {
  // Default values if design object is missing
  const primaryColor = design?.colors?.primary || "rgba(0, 74, 198, 1)"; // primary fallback
  const textColor = design?.colors?.text || "rgba(0, 0, 0, 1)";
  const backgroundColor = design?.colors?.background || "rgba(255, 255, 255, 1)";

  // We convert the dynamic styles into CSS custom properties
  const style: React.CSSProperties = {
    "--color-primary": primaryColor,
    "--color-text": textColor,
    "--color-background": backgroundColor,
  } as React.CSSProperties;

  return (
    <div style={style} className="resume-theme-root font-sans text-[var(--color-text)]">
      {children}
    </div>
  );
}
