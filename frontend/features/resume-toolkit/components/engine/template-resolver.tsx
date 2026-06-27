import { TemplateProps } from "./types";
import { ModernTemplate } from "./templates/modern-template";

export function resolveTemplate(templateId: string): React.ComponentType<TemplateProps> {
  switch (templateId) {
    case "modern":
      return ModernTemplate;
    // Add future templates here
    default:
      // Fallback to modern if template is missing or unknown
      return ModernTemplate;
  }
}
