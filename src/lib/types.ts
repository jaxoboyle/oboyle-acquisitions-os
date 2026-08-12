export type Stage =
  | "new_lead"
  | "attempted_contact"
  | "contacted"
  | "follow_up"
  | "qualified_lead"
  | "appointment_scheduled"
  | "offer_sent"
  | "negotiating"
  | "under_contract"
  | "finding_buyer"
  | "sent_to_title"
  | "closing_scheduled"
  | "closed"
  | "dead_lead";

export const STAGES: { id: Stage; label: string }[] = [
  { id: "new_lead", label: "New Lead" },
  { id: "attempted_contact", label: "Attempted Contact" },
  { id: "contacted", label: "Contacted" },
  { id: "follow_up", label: "Follow-Up" },
  { id: "qualified_lead", label: "Qualified Lead" },
  { id: "appointment_scheduled", label: "Appointment Scheduled" },
  { id: "offer_sent", label: "Offer Sent" },
  { id: "negotiating", label: "Negotiating" },
  { id: "under_contract", label: "Under Contract" },
  { id: "finding_buyer", label: "Finding Buyer" },
  { id: "sent_to_title", label: "Sent to Title" },
  { id: "closing_scheduled", label: "Closing Scheduled" },
  { id: "closed", label: "Closed" },
  { id: "dead_lead", label: "Dead Lead" },
];

export function stageLabel(stage: string): string {
  return STAGES.find((s) => s.id === stage)?.label ?? stage;
}

export type Priority = "low" | "medium" | "high";
export const PRIORITIES: { id: Priority; label: string }[] = [
  { id: "high", label: "High" },
  { id: "medium", label: "Medium" },
  { id: "low", label: "Low" },
];

export const CONTACT_METHODS = ["Phone", "Text", "Email"];
export const OCCUPANCY_OPTIONS = [
  { id: "occupied", label: "Occupied" },
  { id: "vacant", label: "Vacant" },
];
export const PROPERTY_TYPES = [
  "Single Family",
  "Duplex",
  "Small Multifamily",
  "Condo/Townhome",
  "Mobile Home",
  "Land",
  "Other",
];

export interface Lead {
  id: string;
  stage: Stage;
  stageOrder: number;

  sellerName: string;
  phone: string | null;
  email: string | null;
  preferredContactMethod: string | null;
  bestTimeToCall: string | null;

  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  parcelNumber: string | null;
  propertyType: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  squareFootage: number | null;
  yearBuilt: number | null;
  occupancy: string | null;

  reasonForSelling: string | null;
  desiredTimeline: string | null;
  askingPrice: number | null;
  mortgageBalance: number | null;
  knownLiens: string | null;
  unpaidTaxes: number | null;
  propertyCondition: string | null;
  repairsNeeded: string | null;
  conversationNotes: string | null;

  arv: number | null;
  estimatedRepairCosts: number | null;
  mao: number | null;
  offerAmount: number | null;
  contractPrice: number | null;
  buyerPrice: number | null;
  estimatedAssignmentFee: number | null;

  leadSource: string | null;
  priority: Priority;
  lastContactDate: string | null;
  nextFollowUpDate: string | null;
  assignedUser: string | null;

  createdAt: string;
  updatedAt: string;
}

export type LeadInput = Omit<Lead, "id" | "stage" | "stageOrder" | "createdAt" | "updatedAt">;

export interface BuyerPreviousDeal {
  id: string;
  buyerId: string;
  propertyAddress: string | null;
  dealDate: string | null;
  price: number | null;
  notes: string | null;
}

export type BuyerPreviousDealInput = Omit<BuyerPreviousDeal, "id" | "buyerId">;

export type FundingType = "cash" | "financing" | "both";

export interface Buyer {
  id: string;
  buyerName: string;
  companyName: string | null;
  phone: string | null;
  email: string | null;
  areas: string | null;
  propertyTypes: string | null;
  maxPurchasePrice: number | null;
  maxRepairLevel: string | null;
  fundingType: FundingType;
  proofOfFundsStatus: string | null;
  typicalClosingSpeed: string | null;
  preferredTitleCompany: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  previousDeals: BuyerPreviousDeal[];
}

export type BuyerInput = Omit<Buyer, "id" | "createdAt" | "updatedAt" | "previousDeals"> & {
  previousDeals: BuyerPreviousDealInput[];
};

export const TITLE_STATUSES = [
  "not_started",
  "search_in_progress",
  "clear",
  "issue_found",
  "resolved",
];
export const CLOSING_STATUSES = ["pending", "scheduled", "delayed", "closed", "fell_through"];

export interface Deal {
  id: string;
  leadId: string;
  contractDate: string | null;
  earnestMoneyAmount: number | null;
  earnestMoneyDueDate: string | null;
  inspectionPeriodEndDate: string | null;
  closingDate: string | null;
  titleCompanyName: string | null;
  titleCompanyPhone: string | null;
  titleCompanyEmail: string | null;
  endBuyerId: string | null;
  endBuyerName: string | null;
  buyerDeposit: number | null;
  assignmentFee: number | null;
  titleStatus: string;
  closingStatus: string;
  dealNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type DealInput = Omit<Deal, "id" | "leadId" | "createdAt" | "updatedAt">;

export interface DealWithLead extends Deal {
  sellerName: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
}

export const DOCUMENT_CATEGORIES: { id: string; label: string }[] = [
  { id: "purchase_agreement", label: "Purchase Agreement" },
  { id: "seller_disclosures", label: "Seller Disclosures" },
  { id: "assignment_agreement", label: "Assignment Agreement" },
  { id: "proof_of_funds", label: "Proof of Funds" },
  { id: "inspection_documents", label: "Inspection Documents" },
  { id: "closing_documents", label: "Closing Documents" },
  { id: "other", label: "Other" },
];

export interface Document {
  id: string;
  leadId: string;
  category: string;
  fileName: string;
  storedPath: string;
  uploadedAt: string;
}

export const TASK_TYPES: { id: string; label: string }[] = [
  { id: "follow_up", label: "Seller Follow-Up" },
  { id: "appointment", label: "Appointment" },
  { id: "offer_response", label: "Offer Needing Response" },
  { id: "earnest_money", label: "Earnest Money Deadline" },
  { id: "inspection", label: "Inspection Deadline" },
  { id: "title_issue", label: "Title Issue" },
  { id: "buyer_deposit", label: "Buyer Deposit" },
  { id: "closing", label: "Closing Date" },
  { id: "other", label: "Other" },
];

export interface Task {
  id: string;
  leadId: string | null;
  taskType: string;
  title: string;
  notes: string | null;
  dueDate: string;
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
}

export type TaskInput = Omit<Task, "id" | "completed" | "completedAt" | "createdAt">;

export interface TaskWithLead extends Task {
  leadSellerName: string | null;
  leadAddress: string | null;
}

export const ACTIVITY_TYPES: { id: string; label: string }[] = [
  { id: "call", label: "Call" },
  { id: "text", label: "Text Message" },
  { id: "email", label: "Email" },
  { id: "note", label: "Note" },
  { id: "status_change", label: "Status Change" },
  { id: "offer", label: "Offer" },
  { id: "appointment", label: "Appointment" },
  { id: "document", label: "Document" },
];

export interface ActivityEntry {
  id: string;
  leadId: string;
  activityType: string;
  description: string;
  metadata: string | null;
  createdAt: string;
}

export type ActivityInput = Omit<ActivityEntry, "id" | "leadId" | "createdAt">;

export interface UpcomingClosing {
  leadId: string;
  sellerName: string;
  address: string | null;
  closingDate: string;
}

export interface DashboardStats {
  totalLeads: number;
  newLeads: number;
  followUpsDueToday: number;
  offersSent: number;
  underContract: number;
  needingBuyers: number;
  upcomingClosings: UpcomingClosing[];
  expectedAssignmentFees: number;
  closedDealsThisMonth: number;
}

export interface BackupInfo {
  fileName: string;
  path: string;
}
