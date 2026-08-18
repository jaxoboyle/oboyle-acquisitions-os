"use client";

import { useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { createClient } from "@/lib/supabase/client";

interface LeadOption {
  id: string;
  seller_name: string;
  address: string | null;
}

export function LeadPickerDialog({
  onSelect,
  onClose,
}: {
  onSelect: (lead: LeadOption) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LeadOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    setLoading(true);
    const timer = setTimeout(async () => {
      let q = supabase.from("leads").select("id, seller_name, address").is("deleted_at", null).order("created_at", { ascending: false }).limit(20);
      if (query.trim()) {
        q = q.or(`seller_name.ilike.%${query}%,address.ilike.%${query}%`);
      }
      const { data } = await q;
      setResults(data ?? []);
      setLoading(false);
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <Modal title="Save to Lead" description="Pick a lead to attach this analysis to." onClose={onClose} widthClassName="max-w-md">
      <div className="space-y-3">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
          <input
            autoFocus
            className="input pl-8 text-sm"
            placeholder="Search leads by seller or address…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="max-h-72 overflow-y-auto space-y-1">
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 size={16} className="animate-spin text-text-subtle" />
            </div>
          ) : results.length === 0 ? (
            <p className="text-sm text-text-muted py-2">No matching leads.</p>
          ) : (
            results.map((lead) => (
              <button
                key={lead.id}
                onClick={() => onSelect(lead)}
                className="w-full text-left px-3 py-2 rounded hover:bg-surface-hover transition-colors"
              >
                <p className="text-sm text-text font-medium">{lead.seller_name}</p>
                <p className="text-xs text-text-subtle">{lead.address ?? "No address on file"}</p>
              </button>
            ))
          )}
        </div>

        <div className="flex justify-end pt-1">
          <button onClick={onClose} className="btn-secondary text-sm">Cancel</button>
        </div>
      </div>
    </Modal>
  );
}
