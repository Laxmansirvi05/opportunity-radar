import React from "react";
import { ResumeRendererProps, RenderContext } from "./types";
import { resolveTemplate } from "./template-resolver";
import { ThemeProvider } from "./core/theme-provider";
import { DocumentLayout } from "./core/document-layout";

export function ResumeRenderer({
  resumeData,
  templateId,
  context,
}: ResumeRendererProps) {
  // Default context if not fully provided
  const finalContext: RenderContext = {
    mode: context?.mode || "preview",
    zoom: context?.zoom || 1,
    readOnly: context?.readOnly ?? true,
    print: context?.print ?? false,
  };

  // The requested template or fallback to the one in metadata
  const activeTemplateId = templateId || resumeData.metadata?.template || "modern";
  
  // Resolve the actual React component for this template
  const TemplateComponent = React.useMemo(() => resolveTemplate(activeTemplateId), [activeTemplateId]);

  return (
    <ThemeProvider design={resumeData.metadata?.design}>
      <DocumentLayout 
        page={resumeData.metadata?.page} 
        context={finalContext}
      >
        {/* eslint-disable-next-line react-hooks/static-components */}
        <TemplateComponent data={resumeData} context={finalContext} />
      </DocumentLayout>
    </ThemeProvider>
  );
}
