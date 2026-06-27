export function CareerInsightsPanel() {
  return (
    <div className="w-[320px] shrink-0 bg-background flex flex-col h-full overflow-y-auto p-6 hidden xl:flex">
      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-[24px] flex flex-col shadow-sm transition-shadow duration-200 hover:shadow-md">
        <h2 className="text-[18px] leading-[1.4] font-semibold text-on-background mb-[24px] tracking-tight">Career Insights</h2>

        {/* Resume Strength Section */}
        <div className="mb-[32px]">
          <div className="flex justify-between items-end mb-[16px]">
            <span className="text-[12px] leading-[1.2] font-medium text-on-surface-variant tracking-[0.02em]">Resume<br/>Strength</span>
            <span className="text-[14px] leading-[1.5] font-semibold text-primary">+12% this<br/>month</span>
          </div>
          
          {/* Bar chart */}
          <div className="h-[120px] flex items-end justify-between gap-[4px] pb-[8px]">
            {/* Mar */}
            <div className="w-full bg-primary-fixed-dim rounded-t-[4px] h-[40%] transition-transform duration-200 hover:scale-y-[1.05] origin-bottom cursor-pointer hover:bg-primary-fixed" />
            <div className="w-full bg-primary-fixed-dim rounded-t-[4px] h-[50%] transition-transform duration-200 hover:scale-y-[1.05] origin-bottom cursor-pointer hover:bg-primary-fixed" />
            <div className="w-full bg-primary-fixed-dim rounded-t-[4px] h-[45%] transition-transform duration-200 hover:scale-y-[1.05] origin-bottom cursor-pointer hover:bg-primary-fixed" />
            <div className="w-full bg-primary-fixed-dim rounded-t-[4px] h-[60%] transition-transform duration-200 hover:scale-y-[1.05] origin-bottom cursor-pointer hover:bg-primary-fixed" />
            {/* Apr */}
            <div className="w-full bg-primary-fixed-dim rounded-t-[4px] h-[70%] transition-transform duration-200 hover:scale-y-[1.05] origin-bottom cursor-pointer hover:bg-primary-fixed" />
            <div className="w-full bg-primary-fixed-dim rounded-t-[4px] h-[65%] transition-transform duration-200 hover:scale-y-[1.05] origin-bottom cursor-pointer hover:bg-primary-fixed" />
            {/* May */}
            <div className="w-full bg-primary rounded-t-[4px] h-[85%] transition-transform duration-200 hover:scale-y-[1.05] origin-bottom cursor-pointer hover:bg-primary-container" />
            <div className="w-full bg-primary rounded-t-[4px] h-[100%] transition-transform duration-200 hover:scale-y-[1.05] origin-bottom cursor-pointer hover:bg-primary-container" />
          </div>
          <div className="flex justify-between mt-[4px] border-t border-outline-variant pt-[8px] text-[11px] leading-[1] font-semibold text-on-surface-variant uppercase tracking-[0.01em]">
            <span>MAR</span>
            <span>APR</span>
            <span>MAY</span>
          </div>
        </div>

        {/* Top Skills Detected */}
        <div className="mb-[32px] border-b border-outline-variant pb-[32px]">
          <h3 className="text-[12px] leading-[1.2] font-medium text-on-surface-variant tracking-[0.02em] uppercase mb-[16px]">TOP SKILLS DETECTED</h3>
          <div className="flex flex-wrap gap-[8px]">
            <span className="px-[8px] py-[4px] bg-surface-container hover:bg-surface-container-high transition-colors cursor-default rounded text-[12px] leading-[1.2] font-medium text-on-background">React.js</span>
            <span className="px-[8px] py-[4px] bg-surface-container hover:bg-surface-container-high transition-colors cursor-default rounded text-[12px] leading-[1.2] font-medium text-on-background">UX Design</span>
            <span className="px-[8px] py-[4px] bg-surface-container hover:bg-surface-container-high transition-colors cursor-default rounded text-[12px] leading-[1.2] font-medium text-on-background">Typescript</span>
            <span className="px-[8px] py-[4px] bg-surface-container hover:bg-surface-container-high transition-colors cursor-default rounded text-[12px] leading-[1.2] font-medium text-on-background">Figma</span>
            <span className="px-[8px] py-[4px] bg-surface-container hover:bg-surface-container-high transition-colors cursor-default rounded text-[12px] leading-[1.2] font-medium text-on-background">+4 more</span>
          </div>
        </div>

        {/* Market Demand */}
        <div>
          <h3 className="text-[12px] leading-[1.2] font-medium text-on-surface-variant tracking-[0.02em] uppercase mb-[16px]">MARKET DEMAND</h3>
          <div className="flex gap-[16px] items-center group cursor-default">
            <div className="w-[48px] h-[48px] rounded-lg bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-105">
              <span className="material-symbols-outlined text-[24px]">trending_up</span>
            </div>
            <div>
              <h4 className="text-[14px] leading-[1.5] font-semibold text-on-background">High Demand</h4>
              <p className="text-[12px] leading-[1.5] text-on-surface-variant">
                342 active roles match your profile.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
