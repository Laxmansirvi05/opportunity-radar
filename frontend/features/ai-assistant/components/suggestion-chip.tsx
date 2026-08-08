"use client";

interface SuggestionChipProps {
  label: string;
  onClick: () => void;
}

export function SuggestionChip({ label, onClick }: SuggestionChipProps) {
  return (
    <button
      onClick={onClick}
      className="flex w-full min-h-[72px] items-center justify-center sm:justify-start p-[20px] rounded-[12px] bg-surface-container-lowest border border-outline-variant/30 text-on-surface-variant text-[14px] font-medium shadow-sm shadow-black/[0.02] transition-all duration-200 ease-in-out hover:bg-surface-container-low/50 hover:border-outline-variant/60 hover:text-on-surface hover:shadow active:scale-[0.98]"
    >
      <span className="line-clamp-2 text-left leading-snug">{label}</span>
    </button>
  );
}
