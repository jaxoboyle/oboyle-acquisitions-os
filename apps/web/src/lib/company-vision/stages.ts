export type StageInfo = {
  stage: number;
  name: string;
  description: string;
  whyItMatters: string;
};

export const STAGES: StageInfo[] = [
  {
    stage: 1,
    name: "Wholesaling & Capital Generation",
    description: "Sales ability, seller and buyer relationships, and capital generation through assignment contracts.",
    whyItMatters: "Every dollar of equity in this plan starts as cash generated here. Without a repeatable way to generate capital and relationships, nothing downstream is fundable.",
  },
  {
    stage: 2,
    name: "Repeatable Acquisitions Operation",
    description: "A systemized, repeatable acquisition process and the first hires to support it.",
    whyItMatters: "One person closing deals is a job, not a company. This stage turns a personal skill into a process other people can run.",
  },
  {
    stage: 3,
    name: "Small Commercial Deals",
    description: "First small commercial acquisitions and strategic partnerships.",
    whyItMatters: "Commercial underwriting, financing relationships, and partner trust are built on small deals before they're trusted with large ones.",
  },
  {
    stage: 4,
    name: "Neighborhood Strip Centers",
    description: "Service-based retail, strip centers, and necessity-based tenants.",
    whyItMatters: "Necessity-based retail is the most defensible commercial asset class to start owning — it cash-flows through cycles and builds a track record lenders respect.",
  },
  {
    stage: 5,
    name: "Larger Shopping Centers",
    description: "Larger shopping centers, mixed-use properties, and selected multifamily.",
    whyItMatters: "Scale starts compounding here — larger assets, more sophisticated financing, and a portfolio that behaves like a real institutional book.",
  },
  {
    stage: 6,
    name: "Institutional-Quality Portfolio",
    description: "A professional management team and an institutional-grade commercial real estate portfolio.",
    whyItMatters: "This is the destination: a company that runs itself, owned assets that outlast any one deal, and a portfolio built to be held for generations.",
  },
];

export const VISION_TARGET = 100_000_000;
export const VISION_HORIZON_YEARS = 15;

export function stageInfo(stage: number): StageInfo {
  return STAGES.find((s) => s.stage === stage) ?? STAGES[0];
}
