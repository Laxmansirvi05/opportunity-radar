"use client";

interface SuggestionChipProps {
  label: string;
  icon?: string;
  onClick: () => void;
}

/**
 * A starting prompt.
 *
 * Left-aligned with a leading icon tile rather than a centred block of text:
 * four centred paragraphs read as a wall, while an icon plus a left edge gives
 * the eye a column to scan. The tile carries the same lift-and-turn depth as
 * the sidebar's nav tiles, so the 3D language is one idea across the app
 * rather than a different effect per screen.
 */
export function SuggestionChip({ label, icon = "auto_awesome", onClick }: SuggestionChipProps) {
  return (
    <button
      onClick={onClick}
      className="assistant-prompt group/prompt flex w-full items-start gap-3 rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-3 text-left outline-none transition-all duration-300 ease-note hover:border-primary/40 focus-visible:ring-2 focus-visible:ring-primary"
    >
      <span
        aria-hidden="true"
        className="assistant-prompt-tile grid size-8 shrink-0 place-items-center rounded-[9px] bg-surface-container text-on-surface-variant transition-all duration-300 ease-note group-hover/prompt:bg-primary group-hover/prompt:text-on-primary"
      >
        <span className="material-symbols-outlined text-[17px]">{icon}</span>
      </span>
      <span className="line-clamp-2 pt-0.5 font-body-sm text-[13.5px] leading-snug text-on-surface-variant transition-colors group-hover/prompt:text-on-surface">
        {label}
      </span>
    </button>
  );
}
