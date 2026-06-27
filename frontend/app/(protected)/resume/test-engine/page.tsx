"use client";

import React, { useState } from "react";
import { ResumeRenderer } from "@/features/resume-toolkit/components/engine";
import { sampleResumeData } from "@/features/resume-toolkit/lib/schema/resume/sample";
import { ResumeData } from "@/features/resume-toolkit/lib/schema/resume/data";
import { Button } from "@/components/ui/button";

// A deeply cloned partial resume
const partialResumeData: ResumeData = {
  ...sampleResumeData,
  sections: {
    ...sampleResumeData.sections,
    projects: { ...sampleResumeData.sections.projects, hidden: true },
    certifications: { ...sampleResumeData.sections.certifications, hidden: true },
    volunteer: { ...sampleResumeData.sections.volunteer, hidden: true },
    publications: { ...sampleResumeData.sections.publications, hidden: true },
    interests: { ...sampleResumeData.sections.interests, hidden: true },
    awards: { ...sampleResumeData.sections.awards, hidden: true },
    references: { ...sampleResumeData.sections.references, hidden: true },
  },
  customSections: [],
};

// Completely empty resume structure matching standard data
const emptyResumeData: ResumeData = {
  ...sampleResumeData,
  basics: {
    name: "",
    headline: "",
    email: "",
    phone: "",
    location: "",
    website: { url: "", label: "" },
    customFields: [],
  },
  summary: { title: "", columns: 1, hidden: false, content: "" },
  sections: {
    profiles: { title: "", columns: 1, hidden: false, items: [] },
    experience: { title: "", columns: 1, hidden: false, items: [] },
    education: { title: "", columns: 1, hidden: false, items: [] },
    projects: { title: "", columns: 1, hidden: false, items: [] },
    skills: { title: "", columns: 1, hidden: false, items: [] },
    languages: { title: "", columns: 1, hidden: false, items: [] },
    interests: { title: "", columns: 1, hidden: false, items: [] },
    awards: { title: "", columns: 1, hidden: false, items: [] },
    certifications: { title: "", columns: 1, hidden: false, items: [] },
    publications: { title: "", columns: 1, hidden: false, items: [] },
    volunteer: { title: "", columns: 1, hidden: false, items: [] },
    references: { title: "", columns: 1, hidden: false, items: [] },
  },
  customSections: [],
};

export default function TestEnginePage() {
  const [dataMode, setDataMode] = useState<"empty" | "partial" | "complete" | "large">("complete");
  const [zoom, setZoom] = useState(1);

  let activeData = sampleResumeData;
  if (dataMode === "empty") activeData = emptyResumeData;
  if (dataMode === "partial") activeData = partialResumeData;

  return (
    <div className="flex w-full h-full min-h-screen bg-surface-container-lowest">
      <div className="w-[300px] border-r border-outline-variant bg-surface-container p-6 flex flex-col gap-6">
        <div>
          <h2 className="text-lg font-bold mb-4 text-on-surface">Engine Test</h2>
          <div className="flex flex-col gap-2">
            <Button variant={dataMode === "empty" ? "default" : "outline"} onClick={() => setDataMode("empty")}>
              Empty Resume
            </Button>
            <Button variant={dataMode === "partial" ? "default" : "outline"} onClick={() => setDataMode("partial")}>
              Partial Resume
            </Button>
            <Button variant={dataMode === "complete" ? "default" : "outline"} onClick={() => setDataMode("complete")}>
              Complete Resume
            </Button>
          </div>
        </div>

        <div className="mt-8">
          <h3 className="text-sm font-semibold mb-2">Zoom / Scale</h3>
          <input 
            type="range" 
            min="0.25" 
            max="1.5" 
            step="0.05" 
            value={zoom} 
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            className="w-full"
          />
          <div className="text-xs text-center mt-1">{(zoom * 100).toFixed(0)}%</div>
        </div>
      </div>
      
      <div className="flex-1 h-screen overflow-y-auto">
        <ResumeRenderer 
          resumeData={activeData}
          templateId="modern"
          context={{ mode: "preview", zoom, readOnly: true, print: false }}
        />
      </div>
    </div>
  );
}
