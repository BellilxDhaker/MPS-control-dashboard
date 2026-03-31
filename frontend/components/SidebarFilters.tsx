"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

type SidebarFiltersProps = {
  resources: string[];
  selectedResource: string | null;
  onResourceChange: (resource: string | null) => void;
};

export function SidebarFilters({
  resources = [],
  selectedResource,
  onResourceChange,
}: SidebarFiltersProps) {
  const [resourceSearch, setResourceSearch] = useState("");

  const filteredResources = useMemo(() => {
    return (resources || []).filter((resource) =>
      resource.toLowerCase().includes(resourceSearch.toLowerCase()),
    );
  }, [resources, resourceSearch]);

  return (
    <div className="rounded-[28px] border border-black/10 bg-[color:var(--surface)] p-6 shadow-[0_16px_40px_rgba(25,32,40,0.08)]">
      <h3 className="text-sm font-semibold uppercase tracking-[0.3em] text-[color:var(--muted)]">
        Filters
      </h3>

      <div className="mt-6 space-y-5">
        {/* Resource Search */}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-[color:var(--foreground)]">
            Resource (Resource_on_Product)
          </span>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-[color:var(--muted)]" />
            <input
              type="text"
              placeholder="Search resources..."
              value={resourceSearch}
              onChange={(e) => setResourceSearch(e.target.value)}
              className="w-full rounded-[12px] border border-black/10 bg-white pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]"
            />
          </div>
          <select
            value={selectedResource || ""}
            onChange={(e) => {
              onResourceChange(e.target.value ? e.target.value : null);
              setResourceSearch("");
            }}
            className="max-h-48 rounded-[12px] border border-black/10 bg-white px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[color:var(--accent)]"
          >
            <>
              <option value="">All Resources</option>
              {filteredResources.map((resource) => (
                <option key={resource} value={resource}>
                  {resource}
                </option>
              ))}
            </>
          </select>
        </div>
      </div>
    </div>
  );
}
