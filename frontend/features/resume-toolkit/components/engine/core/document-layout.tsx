import React from "react";
import { Page } from "@/features/resume-toolkit/lib/schema/resume/data";
import { RenderContext } from "../types";
import { cn } from "@/lib/utils";

interface DocumentLayoutProps {
  page?: Page;
  context: RenderContext;
  children: React.ReactNode;
}

const PAGE_DIMENSIONS = {
  a4: { width: 794, height: 1123 }, // 210mm x 297mm at 96 DPI
  letter: { width: 816, height: 1056 }, // 8.5in x 11in at 96 DPI
  "free-form": { width: "100%", height: "auto" },
};

export function DocumentLayout({ page, context, children }: DocumentLayoutProps) {
  const format = page?.format || "a4";
  const dimensions = PAGE_DIMENSIONS[format as keyof typeof PAGE_DIMENSIONS];
  
  // Padding based on page schema (converted to px from pt, roughly 1pt = 1.33px)
  const paddingX = (page?.marginX || 36) * 1.33; 
  const paddingY = (page?.marginY || 36) * 1.33;

  // Zoom logic
  const scale = context.zoom || 1;

  // Render mode adjustments
  const isPrint = context.print || context.mode === "pdf";

  return (
    <div 
      className={cn(
        "resume-document-container flex justify-center origin-top relative",
        !isPrint && "bg-surface-container overflow-hidden min-h-screen py-8"
      )}
    >
      <div
        className={cn(
          "resume-document bg-[var(--color-background)]",
          !isPrint && "shadow-xl border border-outline-variant",
          "print:shadow-none print:border-none print:m-0"
        )}
        style={{
          width: isPrint ? "100%" : dimensions.width,
          minHeight: isPrint ? "auto" : dimensions.height,
          padding: `${paddingY}px ${paddingX}px`,
          transform: !isPrint && scale !== 1 ? `scale(${scale})` : "none",
          transformOrigin: "top center",
          // Printing styles applied globally
          pageBreakInside: "auto",
        }}
      >
        {children}
      </div>

      {/* Global CSS for Print */}
      {isPrint && (
        <style dangerouslySetInnerHTML={{__html: `
          @page {
            size: ${format === 'a4' ? 'A4' : 'Letter'};
            margin: 0;
          }
          body {
            margin: 0;
            background: white;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        `}} />
      )}
    </div>
  );
}
