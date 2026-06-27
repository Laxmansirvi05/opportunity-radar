import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'AI Optimizer | Resume Toolkit',
}

export default function CopilotPage() {
  return (
    <div className="flex-1 flex flex-col h-full bg-background p-6 lg:p-[40px] overflow-y-auto items-center">
      <div className="w-full max-w-[800px] flex flex-col h-full">
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-[32px] leading-[1.2] font-semibold tracking-[-0.02em] text-on-background mb-2">AI Resume Optimizer</h1>
            <p className="text-[14px] leading-[1.5] text-on-surface-variant">
              Perfecting your profile for specific career opportunities.
            </p>
          </div>
          <div className="bg-secondary-container text-on-secondary-container px-[16px] py-[6px] rounded-full flex items-center gap-2 font-medium text-[14px] leading-[1.5]">
            <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
            AI Powered
          </div>
        </div>

        {/* Stepper + Gaps Container */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg shadow-sm flex flex-col mb-8 transition-shadow duration-200 hover:shadow-md">
          
          {/* Stepper Header */}
          <div className="bg-surface-container-low border-b border-outline-variant p-4 flex items-center justify-between rounded-t-lg">
            <div className="flex items-center gap-[24px]">
              <div className="flex items-center gap-[8px]">
                <div className="w-[24px] h-[24px] rounded-full bg-primary text-on-primary flex items-center justify-center text-[12px] font-bold shadow-sm">1</div>
                <span className="text-[14px] font-semibold text-primary">Analysis</span>
              </div>
              <div className="h-px w-[32px] bg-outline-variant"></div>
              <div className="flex items-center gap-[8px] opacity-60">
                <div className="w-[24px] h-[24px] rounded-full bg-surface-variant text-on-surface-variant flex items-center justify-center text-[12px] font-bold">2</div>
                <span className="text-[14px] font-medium text-on-surface-variant">Optimization</span>
              </div>
            </div>
            <div className="flex items-center gap-[8px] text-primary text-[12px] font-medium">
              <span className="material-symbols-outlined text-[16px]">history</span>
              Last saved 2m ago
            </div>
          </div>

          {/* Main Content Area */}
          <div className="p-[24px]">
            <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-[24px]">
              
              {/* ATS Score Card */}
              <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-6 flex flex-col items-center justify-center text-center transition-all duration-200 hover:border-primary/30">
                {/* Donut Chart Simulation */}
                <div className="relative w-[120px] h-[120px] mb-[16px] flex items-center justify-center">
                  <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="40" stroke="var(--color-surface-variant)" strokeWidth="8" fill="transparent" />
                    <circle cx="50" cy="50" r="40" stroke="var(--color-primary)" strokeWidth="8" fill="transparent" strokeDasharray="251.2" strokeDashoffset="80.38" strokeLinecap="round" className="transition-all duration-1000 ease-out" />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-[32px] font-bold text-primary tracking-tight">68</span>
                    <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-[0.01em] mt-1">ATS Score</span>
                  </div>
                </div>
                <p className="text-[12px] leading-[1.5] text-on-surface-variant">
                  Improve your score to 85+ for best results
                </p>
              </div>

              {/* Critical Gaps */}
              <div>
                <h2 className="text-[18px] leading-[1.4] font-semibold text-on-background mb-[16px]">Critical Gaps</h2>
                <div className="space-y-[12px]">
                  
                  {/* Gap 1 (Red) */}
                  <div className="bg-error-container rounded-lg p-[16px] flex gap-[12px] transition-transform duration-200 hover:-translate-y-0.5">
                    <div className="text-on-error-container shrink-0 mt-[2px]">
                      <span className="material-symbols-outlined text-[20px]">warning</span>
                    </div>
                    <div>
                      <h3 className="text-[14px] leading-[1.5] font-semibold text-on-error-container mb-[2px]">Missing Action Verbs</h3>
                      <p className="text-[12px] leading-[1.5] text-on-error-container opacity-90">Use words like &quot;Orchestrated&quot;, &quot;Developed&quot;, or &quot;Initiated&quot;.</p>
                    </div>
                  </div>

                  {/* Gap 2 (Orange) */}
                  <div className="bg-tertiary-container rounded-lg p-[16px] flex gap-[12px] transition-transform duration-200 hover:-translate-y-0.5">
                    <div className="text-on-tertiary-container shrink-0 mt-[2px]">
                      <span className="material-symbols-outlined text-[20px]">lightbulb</span>
                    </div>
                    <div>
                      <h3 className="text-[14px] leading-[1.5] font-semibold text-on-tertiary-container mb-[2px]">Quantifiable Results</h3>
                      <p className="text-[12px] leading-[1.5] text-on-tertiary-container opacity-90">Add metrics (%, $, numbers) to your achievements.</p>
                    </div>
                  </div>

                  {/* Gap 3 (Gray) */}
                  <div className="bg-surface-container rounded-lg p-[16px] flex gap-[12px] transition-transform duration-200 hover:-translate-y-0.5">
                    <div className="text-on-surface-variant shrink-0 mt-[2px]">
                      <span className="material-symbols-outlined text-[20px]">search</span>
                    </div>
                    <div>
                      <h3 className="text-[14px] leading-[1.5] font-semibold text-on-background mb-[2px]">Skills Alignment</h3>
                      <p className="text-[12px] leading-[1.5] text-on-surface-variant">Python and Cloud Architecture keys not detected.</p>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Generated Result Preview */}
        <div className="flex flex-col flex-1 min-h-[400px]">
          <h2 className="text-[18px] leading-[1.4] font-semibold text-on-background mb-[16px]">Generated Result Preview</h2>
          <div className="flex-1 border border-outline-variant rounded-lg bg-surface-container-lowest p-[24px] flex flex-col shadow-sm transition-shadow duration-200 hover:shadow-md">
            
            {/* Skeleton / Placeholder lines */}
            <div className="flex-1 flex flex-col items-center justify-center gap-[24px] py-[48px] animate-pulse">
              <div className="w-[33%] h-[32px] bg-surface-container-highest rounded"></div>
              <div className="w-[66%] h-[16px] bg-surface-container-highest rounded-full"></div>
              <div className="w-[75%] h-[16px] bg-surface-container-highest rounded-full"></div>
              <div className="w-[50%] h-[16px] bg-surface-container-highest rounded-full"></div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center justify-between border-t border-outline-variant pt-[24px] mt-[24px]">
              <button className="flex items-center gap-[8px] px-[24px] py-[10px] rounded border border-outline-variant font-semibold text-[14px] text-on-background hover:bg-surface-container transition-colors">
                <span className="material-symbols-outlined text-[20px]">visibility</span>
                Preview Full
              </button>
              <button className="flex items-center gap-[8px] px-[24px] py-[10px] rounded bg-primary text-on-primary font-semibold text-[14px] hover:bg-primary-container hover:text-on-primary-container transition-colors shadow-sm">
                <span className="material-symbols-outlined text-[20px]">auto_fix</span>
                Apply All AI Fixes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
