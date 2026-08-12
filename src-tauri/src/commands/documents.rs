use crate::db::{documents_dir, DbState};
use crate::error::{AppError, AppResult};
use crate::models::{ActivityInput, Document};
use crate::util::{new_id, now_iso};
use rusqlite::params;
use std::fs;
use std::path::Path;
use tauri::{AppHandle, Manager, State};

use super::activity::add_activity_internal;

const CATEGORIES: &[&str] = &[
    "purchase_agreement",
    "seller_disclosures",
    "assignment_agreement",
    "proof_of_funds",
    "inspection_documents",
    "closing_documents",
    "other",
];

#[tauri::command]
pub fn documents_list(db: State<DbState>, lead_id: String) -> AppResult<Vec<Document>> {
    let conn = db.0.lock().unwrap();
    let mut stmt = conn.prepare(
        "SELECT id, lead_id, category, file_name, stored_path, uploaded_at
         FROM documents WHERE lead_id = ?1 ORDER BY uploaded_at DESC",
    )?;
    let rows = stmt.query_map(params![lead_id], Document::from_row)?;
    let mut out = Vec::new();
    for r in rows {
        out.push(r?);
    }
    Ok(out)
}

#[tauri::command]
pub fn documents_add(
    app: AppHandle,
    db: State<DbState>,
    lead_id: String,
    category: String,
    source_path: String,
) -> AppResult<Document> {
    if !CATEGORIES.contains(&category.as_str()) {
        return Err(AppError::Validation("Unknown document category".into()));
    }
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Other(e.to_string()))?;

    let source = Path::new(&source_path);
    let file_name = source
        .file_name()
        .ok_or_else(|| AppError::Validation("Invalid file path".into()))?
        .to_string_lossy()
        .to_string();

    let lead_dir = documents_dir(&app_data_dir).join(&lead_id);
    fs::create_dir_all(&lead_dir)?;

    let id = new_id();
    let stored_name = format!("{id}_{file_name}");
    let dest_abs = lead_dir.join(&stored_name);
    fs::copy(source, &dest_abs)?;

    let stored_path = format!("{lead_id}/{stored_name}");
    let now = now_iso();

    let conn = db.0.lock().unwrap();
    conn.execute(
        "INSERT INTO documents (id, lead_id, category, file_name, stored_path, uploaded_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![id, lead_id, category, file_name, stored_path, now],
    )?;

    add_activity_internal(
        &conn,
        &lead_id,
        ActivityInput {
            activity_type: "document".into(),
            description: format!("Uploaded document: {file_name}"),
            metadata: None,
        },
    )?;

    Ok(conn.query_row(
        "SELECT id, lead_id, category, file_name, stored_path, uploaded_at FROM documents WHERE id = ?1",
        params![id],
        Document::from_row,
    )?)
}

#[tauri::command]
pub fn documents_delete(app: AppHandle, db: State<DbState>, id: String) -> AppResult<()> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Other(e.to_string()))?;

    let conn = db.0.lock().unwrap();
    let stored_path: Option<String> = conn
        .query_row(
            "SELECT stored_path FROM documents WHERE id = ?1",
            params![id],
            |r| r.get(0),
        )
        .ok();

    if let Some(rel) = stored_path {
        let _ = fs::remove_file(documents_dir(&app_data_dir).join(rel));
    }
    conn.execute("DELETE FROM documents WHERE id = ?1", params![id])?;
    Ok(())
}

#[tauri::command]
pub fn documents_absolute_path(app: AppHandle, db: State<DbState>, id: String) -> AppResult<String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Other(e.to_string()))?;
    let conn = db.0.lock().unwrap();
    let stored_path: String = conn
        .query_row(
            "SELECT stored_path FROM documents WHERE id = ?1",
            params![id],
            |r| r.get(0),
        )
        .map_err(|_| AppError::NotFound("Document not found".into()))?;
    Ok(documents_dir(&app_data_dir)
        .join(stored_path)
        .to_string_lossy()
        .to_string())
}
