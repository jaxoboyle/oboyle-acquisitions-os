use crate::error::AppResult;
use chrono::Utc;
use rusqlite::Connection;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

pub struct DbState(pub Mutex<Connection>);

const SCHEMA: &str = include_str!("schema.sql");
/// Keep this many most-recent automatic + manual backups before pruning old ones.
const MAX_BACKUPS: usize = 30;

pub fn db_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("wholesale-crm.db")
}

pub fn backups_dir(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("backups")
}

pub fn documents_dir(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("documents")
}

pub fn init_db(app_data_dir: &Path) -> AppResult<Connection> {
    fs::create_dir_all(app_data_dir)?;
    fs::create_dir_all(backups_dir(app_data_dir))?;
    fs::create_dir_all(documents_dir(app_data_dir))?;

    let conn = Connection::open(db_path(app_data_dir))?;
    conn.pragma_update(None, "foreign_keys", true)?;
    conn.execute_batch(SCHEMA)?;
    Ok(conn)
}

/// Copies the live database file into the backups folder, then removes the oldest
/// backups beyond MAX_BACKUPS so the folder doesn't grow forever.
pub fn create_backup(app_data_dir: &Path, conn: &Connection) -> AppResult<PathBuf> {
    // Make sure everything is flushed to the main db file before copying it.
    conn.pragma_update(None, "wal_checkpoint", "TRUNCATE").ok();

    let dir = backups_dir(app_data_dir);
    fs::create_dir_all(&dir)?;

    let stamp = Utc::now().format("%Y-%m-%d_%H-%M-%S");
    let dest = dir.join(format!("wholesale-crm-{stamp}.db"));
    fs::copy(db_path(app_data_dir), &dest)?;

    prune_old_backups(&dir)?;
    Ok(dest)
}

fn prune_old_backups(dir: &Path) -> AppResult<()> {
    let mut entries: Vec<PathBuf> = fs::read_dir(dir)?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| p.extension().map(|e| e == "db").unwrap_or(false))
        .collect();

    entries.sort();
    if entries.len() > MAX_BACKUPS {
        for old in &entries[..entries.len() - MAX_BACKUPS] {
            let _ = fs::remove_file(old);
        }
    }
    Ok(())
}

pub fn list_backups(app_data_dir: &Path) -> AppResult<Vec<(String, String)>> {
    let dir = backups_dir(app_data_dir);
    fs::create_dir_all(&dir)?;
    let mut entries: Vec<(String, String)> = fs::read_dir(&dir)?
        .filter_map(|e| e.ok())
        .filter_map(|e| {
            let path = e.path();
            if path.extension().map(|ext| ext == "db").unwrap_or(false) {
                Some((
                    path.file_name()?.to_string_lossy().to_string(),
                    path.to_string_lossy().to_string(),
                ))
            } else {
                None
            }
        })
        .collect();
    entries.sort_by(|a, b| b.0.cmp(&a.0));
    Ok(entries)
}
