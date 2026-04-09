"use client";

import { useRef, useEffect } from "react";

type TimelineNavigationProps = {
  weeks: string[];
  selectedWeek: string | null;
  onWeekChange: (week: string) => void;
  title?: string;
  description?: string;
};

export function TimelineNavigation({
  weeks,
  selectedWeek,
  onWeekChange,
  title = "Timeline Navigation",
  description = "Click to select a specific week",
}: TimelineNavigationProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to selected week
  useEffect(() => {
    if (!scrollContainerRef.current || !selectedWeek) return;

    const selectedButton = scrollContainerRef.current.querySelector(
      `button[data-week="${selectedWeek}"]`,
    );
    if (selectedButton) {
      selectedButton.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [selectedWeek]);

  const activeWeek = selectedWeek || weeks[0];

  return (
    <div className="rounded-2xl bg-white p-6 shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
      <h3 className="text-lg font-bold text-[#0b2a5b]">{title}</h3>
      {description && (
        <p className="mt-1 text-xs text-slate-500">{description}</p>
      )}
      <div
        ref={scrollContainerRef}
        className="mt-4 flex gap-2 overflow-x-auto pb-2 scroll-smooth"
      >
        {weeks.map((week) => {
          const isActive = week === activeWeek;
          return (
            <button
              key={week}
              data-week={week}
              onClick={() => onWeekChange(week)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold shadow-sm transition ${
                isActive
                  ? "bg-[#0b2a5b] text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {week}
            </button>
          );
        })}
      </div>
    </div>
  );
}
