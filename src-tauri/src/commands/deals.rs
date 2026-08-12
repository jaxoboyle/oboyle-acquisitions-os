use crate::db::DbState;
use crate::error::{AppError, AppResult};
use crate::models::{Deal, DealInput, DealWithLead};
use crate::util::{new_id, now_iso};
use rusqlite::{params, Connection, OptionalExtension};
use tauri::State;

/// Creates a blank deal row for a lead the first time it enters Under Contract,
/// so it immediately shows up in the Deal Tracker ready to be filled in.
pub fn ensure_deal_for_lead(conn: &Connection, lead_id: &str) -> AppResult<()> {
    let exists: Option<String> = conn
        .query_row(
            "SELECT id FROM deals WHERE lead_id = ?1",
            params![lead_id],
            |r| r.get(0),
        )
        .optional()?;

    if exists.is_none() {
        let id = new_id();
        let now = now_iso();
        conn.execute(
            "INSERT INTO deals (id, lead_id, title_status, closing_status, created_at, updated_at)
             VALUES (?1, ?2, 'not_started', 'pending', ?3, ?3)",
            params![id, lead_id, now],
        )?;
    }
    Ok(())
}

fn deal_with_lead_from_row(row: &rusqlite::Row) -> rusqlite::Result<DealWithLead> {
    Ok(DealWithLead {
        deal: Deal::from_row(row)?,
        seller_name: row.get("seller_name")?,
        address: row.get("address")?,
        city: row.get("city")?,
        state: row.get("state")?,
        zip: row.get("zip")?,
    })
}

const DEAL_WITH_LEAD_SELECT: &str = "SELECT d.id, d.lead_id, d.contract_date, d.earnest_money_amount, d.earnest_money_due_date, d.inspection_period_end_date, d.closing_date, d.title_company_name, d.title_company_phone, d.title_company_email, d.end_buyer_id, d.end_buyer_name, d.buyer_deposit, d.assignment_fee, d.title_status, d.closing_status, d.deal_notes, d.created_at, d.updated_at, l.seller_name, l.address, l.city, l.state, l.zip FROM deals d JOIN leads l ON l.id = d.lead_id";

#[tauri::command]
pub fn deals_list(db: State<DbState>) -> AppResult<Vec<DealWithLead>> {
    let conn = db.0.lock().unwrap();
    let sql = format!("{} ORDER BY d.updated_at DESC", DEAL_WITH_LEAD_SELECT);
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], deal_with_lead_from_row)?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

#[tauri::command]
pub fn deals_get_by_lead(db: State<DbState>, lead_id: String) -> AppResult<Option<DealWithLead>> {
    let conn = db.0.lock().unwrap();
    let sql = format!("{} WHERE d.lead_id = ?1", DEAL_WITH_LEAD_SELECT);
    let result = conn
        .query_row(&sql, params![lead_id], deal_with_lead_from_row)
        .optional()?;
    Ok(result)
}

#[tauri::command]
pub fn deals_upsert(db: State<DbState>, lead_id: String, input: DealInput) -> AppResult<Deal> {
    let conn = db.0.lock().unwrap();
    ensure_deal_for_lead(&conn, &lead_id)?;
    let now = now_iso();

    conn.execute(
        "UPDATE deals SET
            contract_date = ?2, earnest_money_amount = ?3, earnest_money_due_date = ?4, inspection_period_end_date = ?5,
            closing_date = ?6, title_company_name = ?7, title_company_phone = ?8, title_company_email = ?9,
            end_buyer_id = ?10, end_buyer_name = ?11, buyer_deposit = ?12, assignment_fee = ?13,
            title_status = ?14, closing_status = ?15, deal_notes = ?16, updated_at = ?17
         WHERE lead_id = ?1",
        params![
            lead_id, input.contract_date, input.earnest_money_amount, input.earnest_money_due_date,
            input.inspection_period_end_date, input.closing_date, input.title_company_name,
            input.title_company_phone, input.title_company_email, input.end_buyer_id, input.end_buyer_name,
            input.buyer_deposit, input.assignment_fee, input.title_status, input.closing_status, input.deal_notes, now,
        ],
    )?;

    let sql = format!(
        "SELECT {} FROM deals WHERE lead_id = ?1",
        Deal::COLUMNS
    );
    conn.query_row(&sql, params![lead_id], Deal::from_row)
        .map_err(|_| AppError::NotFound("Deal not found".into()))
}
