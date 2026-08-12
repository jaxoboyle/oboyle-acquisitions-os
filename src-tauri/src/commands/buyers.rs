use crate::db::DbState;
use crate::error::{AppError, AppResult};
use crate::models::{Buyer, BuyerInput, BuyerPreviousDeal};
use crate::util::{new_id, now_iso};
use rusqlite::{params, Connection};
use tauri::State;

fn load_previous_deals(conn: &Connection, buyer_id: &str) -> AppResult<Vec<BuyerPreviousDeal>> {
    let mut stmt = conn.prepare(
        "SELECT id, buyer_id, property_address, deal_date, price, notes
         FROM buyer_previous_deals WHERE buyer_id = ?1 ORDER BY deal_date DESC",
    )?;
    let rows = stmt.query_map(params![buyer_id], |row| {
        Ok(BuyerPreviousDeal {
            id: row.get("id")?,
            buyer_id: row.get("buyer_id")?,
            property_address: row.get("property_address")?,
            deal_date: row.get("deal_date")?,
            price: row.get("price")?,
            notes: row.get("notes")?,
        })
    })?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

fn replace_previous_deals(
    conn: &Connection,
    buyer_id: &str,
    deals: &[crate::models::BuyerPreviousDealInput],
) -> AppResult<()> {
    conn.execute(
        "DELETE FROM buyer_previous_deals WHERE buyer_id = ?1",
        params![buyer_id],
    )?;
    for d in deals {
        conn.execute(
            "INSERT INTO buyer_previous_deals (id, buyer_id, property_address, deal_date, price, notes)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![new_id(), buyer_id, d.property_address, d.deal_date, d.price, d.notes],
        )?;
    }
    Ok(())
}

#[tauri::command]
pub fn buyers_list(db: State<DbState>) -> AppResult<Vec<Buyer>> {
    let conn = db.0.lock().unwrap();
    let sql = format!(
        "SELECT {} FROM buyers ORDER BY buyer_name ASC",
        Buyer::COLUMNS
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], Buyer::from_row)?;
    let mut out = Vec::new();
    for r in rows {
        let mut buyer = r?;
        buyer.previous_deals = load_previous_deals(&conn, &buyer.id)?;
        out.push(buyer);
    }
    Ok(out)
}

#[tauri::command]
pub fn buyers_create(db: State<DbState>, input: BuyerInput) -> AppResult<Buyer> {
    if input.buyer_name.trim().is_empty() {
        return Err(AppError::Validation("Buyer name is required".into()));
    }
    let conn = db.0.lock().unwrap();
    let id = new_id();
    let now = now_iso();

    conn.execute(
        "INSERT INTO buyers (
            id, buyer_name, company_name, phone, email, areas, property_types,
            max_purchase_price, max_repair_level, funding_type, proof_of_funds_status,
            typical_closing_speed, preferred_title_company, notes, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?15)",
        params![
            id, input.buyer_name, input.company_name, input.phone, input.email, input.areas, input.property_types,
            input.max_purchase_price, input.max_repair_level, input.funding_type, input.proof_of_funds_status,
            input.typical_closing_speed, input.preferred_title_company, input.notes, now,
        ],
    )?;
    replace_previous_deals(&conn, &id, &input.previous_deals)?;

    let sql = format!("SELECT {} FROM buyers WHERE id = ?1", Buyer::COLUMNS);
    let mut buyer = conn.query_row(&sql, params![id], Buyer::from_row)?;
    buyer.previous_deals = load_previous_deals(&conn, &id)?;
    Ok(buyer)
}

#[tauri::command]
pub fn buyers_update(db: State<DbState>, id: String, input: BuyerInput) -> AppResult<Buyer> {
    if input.buyer_name.trim().is_empty() {
        return Err(AppError::Validation("Buyer name is required".into()));
    }
    let conn = db.0.lock().unwrap();
    let now = now_iso();

    let updated = conn.execute(
        "UPDATE buyers SET
            buyer_name = ?2, company_name = ?3, phone = ?4, email = ?5, areas = ?6, property_types = ?7,
            max_purchase_price = ?8, max_repair_level = ?9, funding_type = ?10, proof_of_funds_status = ?11,
            typical_closing_speed = ?12, preferred_title_company = ?13, notes = ?14, updated_at = ?15
         WHERE id = ?1",
        params![
            id, input.buyer_name, input.company_name, input.phone, input.email, input.areas, input.property_types,
            input.max_purchase_price, input.max_repair_level, input.funding_type, input.proof_of_funds_status,
            input.typical_closing_speed, input.preferred_title_company, input.notes, now,
        ],
    )?;
    if updated == 0 {
        return Err(AppError::NotFound("Buyer not found".into()));
    }
    replace_previous_deals(&conn, &id, &input.previous_deals)?;

    let sql = format!("SELECT {} FROM buyers WHERE id = ?1", Buyer::COLUMNS);
    let mut buyer = conn.query_row(&sql, params![id], Buyer::from_row)?;
    buyer.previous_deals = load_previous_deals(&conn, &id)?;
    Ok(buyer)
}

#[tauri::command]
pub fn buyers_delete(db: State<DbState>, id: String) -> AppResult<()> {
    let conn = db.0.lock().unwrap();
    conn.execute("DELETE FROM buyers WHERE id = ?1", params![id])?;
    Ok(())
}
