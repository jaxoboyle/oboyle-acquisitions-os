mod commands;
mod db;
mod error;
mod models;
mod util;

use commands::{activity, buyers, dashboard, data, deals, documents, leads, tasks};
use db::DbState;
use std::sync::Mutex;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir()?;
            let conn = db::init_db(&app_data_dir)?;

            // Take a startup backup so a bad session never loses more than one day of work.
            let _ = db::create_backup(&app_data_dir, &conn);

            app.manage(DbState(Mutex::new(conn)));
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            leads::leads_list,
            leads::leads_get,
            leads::leads_create,
            leads::leads_update,
            leads::leads_delete,
            leads::leads_move_stage,
            buyers::buyers_list,
            buyers::buyers_create,
            buyers::buyers_update,
            buyers::buyers_delete,
            deals::deals_list,
            deals::deals_get_by_lead,
            deals::deals_upsert,
            documents::documents_list,
            documents::documents_add,
            documents::documents_delete,
            documents::documents_absolute_path,
            tasks::tasks_list,
            tasks::tasks_create,
            tasks::tasks_update,
            tasks::tasks_set_completed,
            tasks::tasks_delete,
            activity::activity_list,
            activity::activity_add,
            dashboard::dashboard_stats,
            data::get_data_dir,
            data::backup_now,
            data::list_backups,
            data::export_leads_csv,
            data::import_leads_csv,
            data::seed_sample_data,
            data::reset_all_data,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
