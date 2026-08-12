use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct Lead {
    pub id: String,
    pub stage: String,
    pub stage_order: f64,

    pub seller_name: String,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub preferred_contact_method: Option<String>,
    pub best_time_to_call: Option<String>,

    pub address: Option<String>,
    pub city: Option<String>,
    pub state: Option<String>,
    pub zip: Option<String>,
    pub parcel_number: Option<String>,
    pub property_type: Option<String>,
    pub bedrooms: Option<i64>,
    pub bathrooms: Option<f64>,
    pub square_footage: Option<i64>,
    pub year_built: Option<i64>,
    pub occupancy: Option<String>,

    pub reason_for_selling: Option<String>,
    pub desired_timeline: Option<String>,
    pub asking_price: Option<f64>,
    pub mortgage_balance: Option<f64>,
    pub known_liens: Option<String>,
    pub unpaid_taxes: Option<f64>,
    pub property_condition: Option<String>,
    pub repairs_needed: Option<String>,
    pub conversation_notes: Option<String>,

    pub arv: Option<f64>,
    pub estimated_repair_costs: Option<f64>,
    pub mao: Option<f64>,
    pub offer_amount: Option<f64>,
    pub contract_price: Option<f64>,
    pub buyer_price: Option<f64>,
    pub estimated_assignment_fee: Option<f64>,

    pub lead_source: Option<String>,
    pub priority: String,
    pub last_contact_date: Option<String>,
    pub next_follow_up_date: Option<String>,
    pub assigned_user: Option<String>,

    pub created_at: String,
    pub updated_at: String,
}

impl Lead {
    pub const COLUMNS: &'static str = "id, stage, stage_order, seller_name, phone, email, preferred_contact_method, best_time_to_call, address, city, state, zip, parcel_number, property_type, bedrooms, bathrooms, square_footage, year_built, occupancy, reason_for_selling, desired_timeline, asking_price, mortgage_balance, known_liens, unpaid_taxes, property_condition, repairs_needed, conversation_notes, arv, estimated_repair_costs, mao, offer_amount, contract_price, buyer_price, estimated_assignment_fee, lead_source, priority, last_contact_date, next_follow_up_date, assigned_user, created_at, updated_at";

    pub fn from_row(row: &rusqlite::Row) -> rusqlite::Result<Self> {
        Ok(Lead {
            id: row.get("id")?,
            stage: row.get("stage")?,
            stage_order: row.get("stage_order")?,
            seller_name: row.get("seller_name")?,
            phone: row.get("phone")?,
            email: row.get("email")?,
            preferred_contact_method: row.get("preferred_contact_method")?,
            best_time_to_call: row.get("best_time_to_call")?,
            address: row.get("address")?,
            city: row.get("city")?,
            state: row.get("state")?,
            zip: row.get("zip")?,
            parcel_number: row.get("parcel_number")?,
            property_type: row.get("property_type")?,
            bedrooms: row.get("bedrooms")?,
            bathrooms: row.get("bathrooms")?,
            square_footage: row.get("square_footage")?,
            year_built: row.get("year_built")?,
            occupancy: row.get("occupancy")?,
            reason_for_selling: row.get("reason_for_selling")?,
            desired_timeline: row.get("desired_timeline")?,
            asking_price: row.get("asking_price")?,
            mortgage_balance: row.get("mortgage_balance")?,
            known_liens: row.get("known_liens")?,
            unpaid_taxes: row.get("unpaid_taxes")?,
            property_condition: row.get("property_condition")?,
            repairs_needed: row.get("repairs_needed")?,
            conversation_notes: row.get("conversation_notes")?,
            arv: row.get("arv")?,
            estimated_repair_costs: row.get("estimated_repair_costs")?,
            mao: row.get("mao")?,
            offer_amount: row.get("offer_amount")?,
            contract_price: row.get("contract_price")?,
            buyer_price: row.get("buyer_price")?,
            estimated_assignment_fee: row.get("estimated_assignment_fee")?,
            lead_source: row.get("lead_source")?,
            priority: row.get("priority")?,
            last_contact_date: row.get("last_contact_date")?,
            next_follow_up_date: row.get("next_follow_up_date")?,
            assigned_user: row.get("assigned_user")?,
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
        })
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LeadInput {
    pub seller_name: String,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub preferred_contact_method: Option<String>,
    pub best_time_to_call: Option<String>,

    pub address: Option<String>,
    pub city: Option<String>,
    pub state: Option<String>,
    pub zip: Option<String>,
    pub parcel_number: Option<String>,
    pub property_type: Option<String>,
    pub bedrooms: Option<i64>,
    pub bathrooms: Option<f64>,
    pub square_footage: Option<i64>,
    pub year_built: Option<i64>,
    pub occupancy: Option<String>,

    pub reason_for_selling: Option<String>,
    pub desired_timeline: Option<String>,
    pub asking_price: Option<f64>,
    pub mortgage_balance: Option<f64>,
    pub known_liens: Option<String>,
    pub unpaid_taxes: Option<f64>,
    pub property_condition: Option<String>,
    pub repairs_needed: Option<String>,
    pub conversation_notes: Option<String>,

    pub arv: Option<f64>,
    pub estimated_repair_costs: Option<f64>,
    pub mao: Option<f64>,
    pub offer_amount: Option<f64>,
    pub contract_price: Option<f64>,
    pub buyer_price: Option<f64>,
    pub estimated_assignment_fee: Option<f64>,

    pub lead_source: Option<String>,
    pub priority: String,
    pub last_contact_date: Option<String>,
    pub next_follow_up_date: Option<String>,
    pub assigned_user: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct Buyer {
    pub id: String,
    pub buyer_name: String,
    pub company_name: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub areas: Option<String>,
    pub property_types: Option<String>,
    pub max_purchase_price: Option<f64>,
    pub max_repair_level: Option<String>,
    pub funding_type: String,
    pub proof_of_funds_status: Option<String>,
    pub typical_closing_speed: Option<String>,
    pub preferred_title_company: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    #[serde(default)]
    pub previous_deals: Vec<BuyerPreviousDeal>,
}

impl Buyer {
    pub const COLUMNS: &'static str = "id, buyer_name, company_name, phone, email, areas, property_types, max_purchase_price, max_repair_level, funding_type, proof_of_funds_status, typical_closing_speed, preferred_title_company, notes, created_at, updated_at";

    pub fn from_row(row: &rusqlite::Row) -> rusqlite::Result<Self> {
        Ok(Buyer {
            id: row.get("id")?,
            buyer_name: row.get("buyer_name")?,
            company_name: row.get("company_name")?,
            phone: row.get("phone")?,
            email: row.get("email")?,
            areas: row.get("areas")?,
            property_types: row.get("property_types")?,
            max_purchase_price: row.get("max_purchase_price")?,
            max_repair_level: row.get("max_repair_level")?,
            funding_type: row.get("funding_type")?,
            proof_of_funds_status: row.get("proof_of_funds_status")?,
            typical_closing_speed: row.get("typical_closing_speed")?,
            preferred_title_company: row.get("preferred_title_company")?,
            notes: row.get("notes")?,
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
            previous_deals: Vec::new(),
        })
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BuyerInput {
    pub buyer_name: String,
    pub company_name: Option<String>,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub areas: Option<String>,
    pub property_types: Option<String>,
    pub max_purchase_price: Option<f64>,
    pub max_repair_level: Option<String>,
    pub funding_type: String,
    pub proof_of_funds_status: Option<String>,
    pub typical_closing_speed: Option<String>,
    pub preferred_title_company: Option<String>,
    pub notes: Option<String>,
    #[serde(default)]
    pub previous_deals: Vec<BuyerPreviousDealInput>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct BuyerPreviousDeal {
    pub id: String,
    pub buyer_id: String,
    pub property_address: Option<String>,
    pub deal_date: Option<String>,
    pub price: Option<f64>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BuyerPreviousDealInput {
    pub property_address: Option<String>,
    pub deal_date: Option<String>,
    pub price: Option<f64>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct Deal {
    pub id: String,
    pub lead_id: String,
    pub contract_date: Option<String>,
    pub earnest_money_amount: Option<f64>,
    pub earnest_money_due_date: Option<String>,
    pub inspection_period_end_date: Option<String>,
    pub closing_date: Option<String>,
    pub title_company_name: Option<String>,
    pub title_company_phone: Option<String>,
    pub title_company_email: Option<String>,
    pub end_buyer_id: Option<String>,
    pub end_buyer_name: Option<String>,
    pub buyer_deposit: Option<f64>,
    pub assignment_fee: Option<f64>,
    pub title_status: String,
    pub closing_status: String,
    pub deal_notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

impl Deal {
    pub const COLUMNS: &'static str = "id, lead_id, contract_date, earnest_money_amount, earnest_money_due_date, inspection_period_end_date, closing_date, title_company_name, title_company_phone, title_company_email, end_buyer_id, end_buyer_name, buyer_deposit, assignment_fee, title_status, closing_status, deal_notes, created_at, updated_at";

    pub fn from_row(row: &rusqlite::Row) -> rusqlite::Result<Self> {
        Ok(Deal {
            id: row.get("id")?,
            lead_id: row.get("lead_id")?,
            contract_date: row.get("contract_date")?,
            earnest_money_amount: row.get("earnest_money_amount")?,
            earnest_money_due_date: row.get("earnest_money_due_date")?,
            inspection_period_end_date: row.get("inspection_period_end_date")?,
            closing_date: row.get("closing_date")?,
            title_company_name: row.get("title_company_name")?,
            title_company_phone: row.get("title_company_phone")?,
            title_company_email: row.get("title_company_email")?,
            end_buyer_id: row.get("end_buyer_id")?,
            end_buyer_name: row.get("end_buyer_name")?,
            buyer_deposit: row.get("buyer_deposit")?,
            assignment_fee: row.get("assignment_fee")?,
            title_status: row.get("title_status")?,
            closing_status: row.get("closing_status")?,
            deal_notes: row.get("deal_notes")?,
            created_at: row.get("created_at")?,
            updated_at: row.get("updated_at")?,
        })
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DealInput {
    pub contract_date: Option<String>,
    pub earnest_money_amount: Option<f64>,
    pub earnest_money_due_date: Option<String>,
    pub inspection_period_end_date: Option<String>,
    pub closing_date: Option<String>,
    pub title_company_name: Option<String>,
    pub title_company_phone: Option<String>,
    pub title_company_email: Option<String>,
    pub end_buyer_id: Option<String>,
    pub end_buyer_name: Option<String>,
    pub buyer_deposit: Option<f64>,
    pub assignment_fee: Option<f64>,
    pub title_status: String,
    pub closing_status: String,
    pub deal_notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct DealWithLead {
    #[serde(flatten)]
    pub deal: Deal,
    pub seller_name: String,
    pub address: Option<String>,
    pub city: Option<String>,
    pub state: Option<String>,
    pub zip: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct Document {
    pub id: String,
    pub lead_id: String,
    pub category: String,
    pub file_name: String,
    pub stored_path: String,
    pub uploaded_at: String,
}

impl Document {
    pub fn from_row(row: &rusqlite::Row) -> rusqlite::Result<Self> {
        Ok(Document {
            id: row.get("id")?,
            lead_id: row.get("lead_id")?,
            category: row.get("category")?,
            file_name: row.get("file_name")?,
            stored_path: row.get("stored_path")?,
            uploaded_at: row.get("uploaded_at")?,
        })
    }
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub lead_id: Option<String>,
    pub task_type: String,
    pub title: String,
    pub notes: Option<String>,
    pub due_date: String,
    pub completed: bool,
    pub completed_at: Option<String>,
    pub created_at: String,
}

impl Task {
    pub fn from_row(row: &rusqlite::Row) -> rusqlite::Result<Self> {
        Ok(Task {
            id: row.get("id")?,
            lead_id: row.get("lead_id")?,
            task_type: row.get("task_type")?,
            title: row.get("title")?,
            notes: row.get("notes")?,
            due_date: row.get("due_date")?,
            completed: row.get::<_, i64>("completed")? != 0,
            completed_at: row.get("completed_at")?,
            created_at: row.get("created_at")?,
        })
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TaskInput {
    pub lead_id: Option<String>,
    pub task_type: String,
    pub title: String,
    pub notes: Option<String>,
    pub due_date: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct TaskWithLead {
    #[serde(flatten)]
    pub task: Task,
    pub lead_seller_name: Option<String>,
    pub lead_address: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct ActivityEntry {
    pub id: String,
    pub lead_id: String,
    pub activity_type: String,
    pub description: String,
    pub metadata: Option<String>,
    pub created_at: String,
}

impl ActivityEntry {
    pub fn from_row(row: &rusqlite::Row) -> rusqlite::Result<Self> {
        Ok(ActivityEntry {
            id: row.get("id")?,
            lead_id: row.get("lead_id")?,
            activity_type: row.get("activity_type")?,
            description: row.get("description")?,
            metadata: row.get("metadata")?,
            created_at: row.get("created_at")?,
        })
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ActivityInput {
    pub activity_type: String,
    pub description: String,
    pub metadata: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct DashboardStats {
    pub total_leads: i64,
    pub new_leads: i64,
    pub follow_ups_due_today: i64,
    pub offers_sent: i64,
    pub under_contract: i64,
    pub needing_buyers: i64,
    pub upcoming_closings: Vec<UpcomingClosing>,
    pub expected_assignment_fees: f64,
    pub closed_deals_this_month: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct UpcomingClosing {
    pub lead_id: String,
    pub seller_name: String,
    pub address: Option<String>,
    pub closing_date: String,
}
