use crate::db::DbState;
use crate::error::{AppError, AppResult};
use crate::models::{ActivityInput, Lead, LeadInput};
use crate::util::{new_id, now_iso};
use rusqlite::params;
use tauri::State;

use super::activity::add_activity_internal;
use super::deals::ensure_deal_for_lead;

pub const STAGES: &[&str] = &[
    "new_lead",
    "attempted_contact",
    "contacted",
    "follow_up",
    "qualified_lead",
    "appointment_scheduled",
    "offer_sent",
    "negotiating",
    "under_contract",
    "finding_buyer",
    "sent_to_title",
    "closing_scheduled",
    "closed",
    "dead_lead",
];

fn stage_label(stage: &str) -> String {
    stage
        .split('_')
        .map(|w| {
            let mut c = w.chars();
            match c.next() {
                Some(f) => f.to_uppercase().collect::<String>() + c.as_str(),
                None => String::new(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ")
}

#[tauri::command]
pub fn leads_list(db: State<DbState>) -> AppResult<Vec<Lead>> {
    let conn = db.0.lock().unwrap();
    let sql = format!(
        "SELECT {} FROM leads ORDER BY stage_order ASC, created_at ASC",
        Lead::COLUMNS
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], Lead::from_row)?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

#[tauri::command]
pub fn leads_get(db: State<DbState>, id: String) -> AppResult<Lead> {
    let conn = db.0.lock().unwrap();
    let sql = format!("SELECT {} FROM leads WHERE id = ?1", Lead::COLUMNS);
    conn.query_row(&sql, params![id], Lead::from_row)
        .map_err(|_| AppError::NotFound("Lead not found".into()))
}

#[tauri::command]
pub fn leads_create(db: State<DbState>, input: LeadInput) -> AppResult<Lead> {
    if input.seller_name.trim().is_empty() {
        return Err(AppError::Validation("Seller name is required".into()));
    }
    let conn = db.0.lock().unwrap();
    let id = new_id();
    let now = now_iso();

    let max_order: f64 = conn
        .query_row(
            "SELECT COALESCE(MAX(stage_order), 0) + 1 FROM leads WHERE stage = 'new_lead'",
            [],
            |r| r.get(0),
        )
        .unwrap_or(1.0);

    conn.execute(
        "INSERT INTO leads (
            id, stage, stage_order, seller_name, phone, email, preferred_contact_method, best_time_to_call,
            address, city, state, zip, parcel_number, property_type, bedrooms, bathrooms, square_footage, year_built, occupancy,
            reason_for_selling, desired_timeline, asking_price, mortgage_balance, known_liens, unpaid_taxes, property_condition, repairs_needed, conversation_notes,
            arv, estimated_repair_costs, mao, offer_amount, contract_price, buyer_price, estimated_assignment_fee,
            lead_source, priority, last_contact_date, next_follow_up_date, assigned_user, created_at, updated_at
        ) VALUES (
            ?1, 'new_lead', ?2, ?3, ?4, ?5, ?6, ?7,
            ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18,
            ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27,
            ?28, ?29, ?30, ?31, ?32, ?33, ?34,
            ?35, ?36, ?37, ?38, ?39, ?40, ?40
        )",
        params![
            id, max_order, input.seller_name, input.phone, input.email, input.preferred_contact_method, input.best_time_to_call,
            input.address, input.city, input.state, input.zip, input.parcel_number, input.property_type, input.bedrooms, input.bathrooms, input.square_footage, input.year_built, input.occupancy,
            input.reason_for_selling, input.desired_timeline, input.asking_price, input.mortgage_balance, input.known_liens, input.unpaid_taxes, input.property_condition, input.repairs_needed, input.conversation_notes,
            input.arv, input.estimated_repair_costs, input.mao, input.offer_amount, input.contract_price, input.buyer_price, input.estimated_assignment_fee,
            input.lead_source, input.priority, input.last_contact_date, input.next_follow_up_date, input.assigned_user, now,
        ],
    )?;

    add_activity_internal(
        &conn,
        &id,
        ActivityInput {
            activity_type: "note".into(),
            description: "Lead created".into(),
            metadata: None,
        },
    )?;

    let sql = format!("SELECT {} FROM leads WHERE id = ?1", Lead::COLUMNS);
    Ok(conn.query_row(&sql, params![id], Lead::from_row)?)
}

#[tauri::command]
pub fn leads_update(db: State<DbState>, id: String, input: LeadInput) -> AppResult<Lead> {
    if input.seller_name.trim().is_empty() {
        return Err(AppError::Validation("Seller name is required".into()));
    }
    let conn = db.0.lock().unwrap();
    let now = now_iso();

    let updated = conn.execute(
        "UPDATE leads SET
            seller_name = ?2, phone = ?3, email = ?4, preferred_contact_method = ?5, best_time_to_call = ?6,
            address = ?7, city = ?8, state = ?9, zip = ?10, parcel_number = ?11, property_type = ?12, bedrooms = ?13, bathrooms = ?14, square_footage = ?15, year_built = ?16, occupancy = ?17,
            reason_for_selling = ?18, desired_timeline = ?19, asking_price = ?20, mortgage_balance = ?21, known_liens = ?22, unpaid_taxes = ?23, property_condition = ?24, repairs_needed = ?25, conversation_notes = ?26,
            arv = ?27, estimated_repair_costs = ?28, mao = ?29, offer_amount = ?30, contract_price = ?31, buyer_price = ?32, estimated_assignment_fee = ?33,
            lead_source = ?34, priority = ?35, last_contact_date = ?36, next_follow_up_date = ?37, assigned_user = ?38, updated_at = ?39
        WHERE id = ?1",
        params![
            id, input.seller_name, input.phone, input.email, input.preferred_contact_method, input.best_time_to_call,
            input.address, input.city, input.state, input.zip, input.parcel_number, input.property_type, input.bedrooms, input.bathrooms, input.square_footage, input.year_built, input.occupancy,
            input.reason_for_selling, input.desired_timeline, input.asking_price, input.mortgage_balance, input.known_liens, input.unpaid_taxes, input.property_condition, input.repairs_needed, input.conversation_notes,
            input.arv, input.estimated_repair_costs, input.mao, input.offer_amount, input.contract_price, input.buyer_price, input.estimated_assignment_fee,
            input.lead_source, input.priority, input.last_contact_date, input.next_follow_up_date, input.assigned_user, now,
        ],
    )?;

    if updated == 0 {
        return Err(AppError::NotFound("Lead not found".into()));
    }

    let sql = format!("SELECT {} FROM leads WHERE id = ?1", Lead::COLUMNS);
    Ok(conn.query_row(&sql, params![id], Lead::from_row)?)
}

#[tauri::command]
pub fn leads_delete(db: State<DbState>, id: String) -> AppResult<()> {
    let conn = db.0.lock().unwrap();
    conn.execute("DELETE FROM leads WHERE id = ?1", params![id])?;
    Ok(())
}

#[tauri::command]
pub fn leads_move_stage(
    db: State<DbState>,
    id: String,
    stage: String,
    stage_order: f64,
) -> AppResult<Lead> {
    if !STAGES.contains(&stage.as_str()) {
        return Err(AppError::Validation("Unknown pipeline stage".into()));
    }
    let conn = db.0.lock().unwrap();

    let sql = format!("SELECT {} FROM leads WHERE id = ?1", Lead::COLUMNS);
    let existing = conn
        .query_row(&sql, params![id], Lead::from_row)
        .map_err(|_| AppError::NotFound("Lead not found".into()))?;

    let now = now_iso();
    conn.execute(
        "UPDATE leads SET stage = ?2, stage_order = ?3, updated_at = ?4 WHERE id = ?1",
        params![id, stage, stage_order, now],
    )?;

    if existing.stage != stage {
        add_activity_internal(
            &conn,
            &id,
            ActivityInput {
                activity_type: "status_change".into(),
                description: format!(
                    "Stage changed from {} to {}",
                    stage_label(&existing.stage),
                    stage_label(&stage)
                ),
                metadata: None,
            },
        )?;

        if stage == "under_contract" {
            ensure_deal_for_lead(&conn, &id)?;
        }
    }

    Ok(conn.query_row(&sql, params![id], Lead::from_row)?)
}
