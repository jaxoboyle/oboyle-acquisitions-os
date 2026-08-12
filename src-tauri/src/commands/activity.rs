use crate::db::DbState;
use crate::error::AppResult;
use crate::models::{ActivityEntry, ActivityInput};
use crate::util::{new_id, now_iso};
use rusqlite::{params, Connection};
use tauri::State;

pub fn add_activity_internal(
    conn: &Connection,
    lead_id: &str,
    input: ActivityInput,
) -> AppResult<ActivityEntry> {
    let id = new_id();
    let now = now_iso();
    conn.execute(
        "INSERT INTO activity_log (id, lead_id, activity_type, description, metadata, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![id, lead_id, input.activity_type, input.description, input.metadata, now],
    )?;
    Ok(conn.query_row(
        "SELECT id, lead_id, activity_type, description, metadata, created_at FROM activity_log WHERE id = ?1",
        params![id],
        ActivityEntry::from_row,
    )?)
}

#[tauri::command]
pub fn activity_list(db: State<DbState>, lead_id: String) -> AppResult<Vec<ActivityEntry>> {
    let conn = db.0.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT id, lead_id, activity_type, description, metadata, created_at
         FROM activity_log WHERE lead_id = ?1 ORDER BY created_at DESC",
    )?;
    let rows = stmt.query_map(params![lead_id], ActivityEntry::from_row)?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

#[tauri::command]
pub fn activity_add(
    db: State<DbState>,
    lead_id: String,
    input: ActivityInput,
) -> AppResult<ActivityEntry> {
    let conn = db.0.lock().unwrap();
    add_activity_internal(&conn, &lead_id, input)
}
