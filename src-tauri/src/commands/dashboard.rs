use crate::db::DbState;
use crate::error::AppResult;
use crate::models::{DashboardStats, UpcomingClosing};
use tauri::State;

#[tauri::command]
pub fn dashboard_stats(db: State<DbState>) -> AppResult<DashboardStats> {
    let conn = db.0.lock().unwrap();

    let total_leads: i64 = conn.query_row("SELECT COUNT(*) FROM leads", [], |r| r.get(0))?;

    let new_leads: i64 = conn.query_row(
        "SELECT COUNT(*) FROM leads WHERE stage = 'new_lead'",
        [],
        |r| r.get(0),
    )?;

    let follow_ups_due_today: i64 = conn.query_row(
        "SELECT COUNT(*) FROM leads
         WHERE next_follow_up_date IS NOT NULL
         AND date(next_follow_up_date) <= date('now')
         AND stage NOT IN ('closed', 'dead_lead')",
        [],
        |r| r.get(0),
    )?;

    let offers_sent: i64 = conn.query_row(
        "SELECT COUNT(*) FROM leads WHERE stage = 'offer_sent'",
        [],
        |r| r.get(0),
    )?;

    let under_contract: i64 = conn.query_row(
        "SELECT COUNT(*) FROM leads WHERE stage IN ('under_contract', 'finding_buyer', 'sent_to_title', 'closing_scheduled')",
        [],
        |r| r.get(0),
    )?;

    let needing_buyers: i64 = conn.query_row(
        "SELECT COUNT(*) FROM leads WHERE stage = 'finding_buyer'",
        [],
        |r| r.get(0),
    )?;

    let expected_assignment_fees: f64 = conn.query_row(
        "SELECT COALESCE(SUM(assignment_fee), 0) FROM deals WHERE closing_status != 'closed'",
        [],
        |r| r.get(0),
    )?;

    let closed_deals_this_month: i64 = conn.query_row(
        "SELECT COUNT(*) FROM deals
         WHERE closing_status = 'closed'
         AND closing_date IS NOT NULL
         AND strftime('%Y-%m', closing_date) = strftime('%Y-%m', 'now')",
        [],
        |r| r.get(0),
    )?;

    let mut stmt = conn.prepare(
        "SELECT l.id, l.seller_name, l.address, d.closing_date
         FROM deals d JOIN leads l ON l.id = d.lead_id
         WHERE d.closing_date IS NOT NULL
         AND date(d.closing_date) >= date('now')
         AND d.closing_status != 'closed'
         ORDER BY d.closing_date ASC LIMIT 5",
    )?;
    let rows = stmt.query_map([], |row| {
        Ok(UpcomingClosing {
            lead_id: row.get(0)?,
            seller_name: row.get(1)?,
            address: row.get(2)?,
            closing_date: row.get(3)?,
        })
    })?;
    let mut upcoming_closings = Vec::new();
    for r in rows {
        upcoming_closings.push(r?);
    }

    Ok(DashboardStats {
        total_leads,
        new_leads,
        follow_ups_due_today,
        offers_sent,
        under_contract,
        needing_buyers,
        upcoming_closings,
        expected_assignment_fees,
        closed_deals_this_month,
    })
}
