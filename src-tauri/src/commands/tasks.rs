use crate::db::DbState;
use crate::error::{AppError, AppResult};
use crate::models::{Task, TaskInput, TaskWithLead};
use crate::util::{new_id, now_iso};
use rusqlite::params;
use tauri::State;

const TASK_WITH_LEAD_SELECT: &str = "SELECT t.id, t.lead_id, t.task_type, t.title, t.notes, t.due_date, t.completed, t.completed_at, t.created_at, l.seller_name, l.address FROM tasks t LEFT JOIN leads l ON l.id = t.lead_id";

fn task_with_lead_from_row(row: &rusqlite::Row) -> rusqlite::Result<TaskWithLead> {
    Ok(TaskWithLead {
        task: Task::from_row(row)?,
        lead_seller_name: row.get("seller_name")?,
        lead_address: row.get("address")?,
    })
}

#[tauri::command]
pub fn tasks_list(db: State<DbState>) -> AppResult<Vec<TaskWithLead>> {
    let conn = db.0.lock().unwrap();
    let sql = format!("{} ORDER BY t.due_date ASC", TASK_WITH_LEAD_SELECT);
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], task_with_lead_from_row)?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

#[tauri::command]
pub fn tasks_create(db: State<DbState>, input: TaskInput) -> AppResult<Task> {
    if input.title.trim().is_empty() {
        return Err(AppError::Validation("Task title is required".into()));
    }
    let conn = db.0.lock().unwrap();
    let id = new_id();
    let now = now_iso();
    conn.execute(
        "INSERT INTO tasks (id, lead_id, task_type, title, notes, due_date, completed, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, ?7)",
        params![id, input.lead_id, input.task_type, input.title, input.notes, input.due_date, now],
    )?;
    Ok(conn.query_row(
        "SELECT id, lead_id, task_type, title, notes, due_date, completed, completed_at, created_at FROM tasks WHERE id = ?1",
        params![id],
        Task::from_row,
    )?)
}

#[tauri::command]
pub fn tasks_update(db: State<DbState>, id: String, input: TaskInput) -> AppResult<Task> {
    if input.title.trim().is_empty() {
        return Err(AppError::Validation("Task title is required".into()));
    }
    let conn = db.0.lock().unwrap();
    let updated = conn.execute(
        "UPDATE tasks SET lead_id = ?2, task_type = ?3, title = ?4, notes = ?5, due_date = ?6 WHERE id = ?1",
        params![id, input.lead_id, input.task_type, input.title, input.notes, input.due_date],
    )?;
    if updated == 0 {
        return Err(AppError::NotFound("Task not found".into()));
    }
    Ok(conn.query_row(
        "SELECT id, lead_id, task_type, title, notes, due_date, completed, completed_at, created_at FROM tasks WHERE id = ?1",
        params![id],
        Task::from_row,
    )?)
}

#[tauri::command]
pub fn tasks_set_completed(db: State<DbState>, id: String, completed: bool) -> AppResult<Task> {
    let conn = db.0.lock().unwrap();
    let completed_at = if completed { Some(now_iso()) } else { None };
    let updated = conn.execute(
        "UPDATE tasks SET completed = ?2, completed_at = ?3 WHERE id = ?1",
        params![id, completed as i64, completed_at],
    )?;
    if updated == 0 {
        return Err(AppError::NotFound("Task not found".into()));
    }
    Ok(conn.query_row(
        "SELECT id, lead_id, task_type, title, notes, due_date, completed, completed_at, created_at FROM tasks WHERE id = ?1",
        params![id],
        Task::from_row,
    )?)
}

#[tauri::command]
pub fn tasks_delete(db: State<DbState>, id: String) -> AppResult<()> {
    let conn = db.0.lock().unwrap();
    conn.execute("DELETE FROM tasks WHERE id = ?1", params![id])?;
    Ok(())
}
