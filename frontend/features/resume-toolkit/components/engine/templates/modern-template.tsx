import React from "react";
import { TemplateProps } from "../types";
import {
  BasicsSection,
  SummarySection,
  ExperienceSection,
  EducationSection,
  SkillsSection,
  ProjectsSection,
  CertificationsSection,
  AwardsSection,
  LanguagesSection,
  ProfilesSection,
  VolunteerSection,
  PublicationsSection,
  InterestsSection,
  ReferencesSection,
} from "../sections";
import { ResumeData } from "@/features/resume-toolkit/lib/schema/resume/data";

function renderSection(id: string, data: ResumeData, context: TemplateProps["context"]) {
  switch (id) {
    case "summary":
      return <SummarySection key={id} data={data.summary} context={context} />;
    case "experience":
      return <ExperienceSection key={id} data={data.sections.experience} context={context} />;
    case "education":
      return <EducationSection key={id} data={data.sections.education} context={context} />;
    case "skills":
      return <SkillsSection key={id} data={data.sections.skills} context={context} />;
    case "projects":
      return <ProjectsSection key={id} data={data.sections.projects} context={context} />;
    case "certifications":
      return <CertificationsSection key={id} data={data.sections.certifications} context={context} />;
    case "awards":
      return <AwardsSection key={id} data={data.sections.awards} context={context} />;
    case "languages":
      return <LanguagesSection key={id} data={data.sections.languages} context={context} />;
    case "profiles":
      return <ProfilesSection key={id} data={data.sections.profiles} context={context} />;
    case "volunteer":
      return <VolunteerSection key={id} data={data.sections.volunteer} context={context} />;
    case "publications":
      return <PublicationsSection key={id} data={data.sections.publications} context={context} />;
    case "interests":
      return <InterestsSection key={id} data={data.sections.interests} context={context} />;
    case "references":
      return <ReferencesSection key={id} data={data.sections.references} context={context} />;
    default: {
      // Check if it's a custom section UUID
      if (data.customSections) {
        const customSection = data.customSections.find(s => s.id === id);
        if (customSection && !customSection.hidden) {
          // A custom section behaves structurally like a normal section, but we don't have dedicated components yet.
          // For now, we will render a generic fallback based on its type if needed, or simply render its title.
          return (
            <section key={id} className={`resume-section custom-section-${customSection.type} flex flex-col gap-3`}>
              <h3 className="text-[14px] font-bold uppercase tracking-wider text-[var(--color-primary)] border-b border-[var(--color-primary)]/20 pb-1 mb-2">
                {customSection.title || customSection.type}
              </h3>
              <div className="flex flex-col gap-4">
                {customSection.items.map((item) => {
                  if (item.hidden) return null;
                  
                  const itemData = item as Record<string, unknown>;
                  const titleStr = String(itemData.title || itemData.name || itemData.company || itemData.organization || "Item");
                  const descStr = String(itemData.description || itemData.content || "");
                  
                  return (
                    <div key={item.id} className="flex flex-col gap-1 break-inside-avoid">
                      <span className="text-[13px] font-semibold text-[var(--color-text)]">
                        {titleStr}
                      </span>
                      {descStr && (
                        <div 
                          className="text-[11.5px] leading-relaxed text-[var(--color-text)] opacity-85 mt-1 prose prose-sm max-w-none prose-p:my-1"
                          dangerouslySetInnerHTML={{ __html: descStr }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        }
      }
      return null;
    }
  }
}

export function ModernTemplate({ data, context }: TemplateProps) {
  // Use the layout from metadata, or fallback to a standard single-column list
  const layout = data.metadata?.layout?.pages?.[0] || {
    main: [
      "summary",
      "experience",
      "education",
      "projects",
      "skills",
      "certifications",
      "awards",
      "languages",
      "profiles",
      "volunteer",
      "publications",
      "interests",
      "references",
    ],
    sidebar: [],
  };

  return (
    <div className="flex flex-col gap-6 w-full h-full">
      <BasicsSection data={data.basics} context={context} />
      
      <div className="flex w-full gap-8">
        <div className="flex flex-col gap-6 flex-1">
          {layout.main.map((sectionId) => renderSection(sectionId, data, context))}
        </div>
        
        {layout.sidebar && layout.sidebar.length > 0 && (
          <div 
            className="flex flex-col gap-6 shrink-0 border-l border-outline-variant/30 pl-8" 
            style={{ width: data.metadata?.layout?.sidebarWidth ? `${data.metadata.layout.sidebarWidth}%` : "30%" }}
          >
            {layout.sidebar.map((sectionId) => renderSection(sectionId, data, context))}
          </div>
        )}
      </div>
    </div>
  );
}
