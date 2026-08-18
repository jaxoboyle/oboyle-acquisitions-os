// Repair category constants shared between the server-only vision analysis
// (repair-vision.ts, which imports the Anthropic SDK and must never end up
// in a client bundle) and client UI components that just need the labels.

export const REPAIR_CATEGORIES = [
  "roof",
  "exterior",
  "windows",
  "kitchen",
  "bathrooms",
  "flooring_paint",
  "hvac",
  "plumbing_electrical_visible",
  "landscaping",
  "structural_concerns",
] as const;

export type RepairCategory = (typeof REPAIR_CATEGORIES)[number];

const CATEGORY_LABELS: Record<RepairCategory, string> = {
  roof: "Roof",
  exterior: "Exterior",
  windows: "Windows",
  kitchen: "Kitchen",
  bathrooms: "Bathrooms",
  flooring_paint: "Flooring/Paint",
  hvac: "HVAC",
  plumbing_electrical_visible: "Plumbing/Electrical (visible only)",
  landscaping: "Landscaping",
  structural_concerns: "Structural concerns",
};

export function categoryLabel(cat: string): string {
  return CATEGORY_LABELS[cat as RepairCategory] ?? cat;
}
