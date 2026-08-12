use uuid::Uuid;

pub fn new_id() -> String {
    Uuid::new_v4().to_string()
}

pub fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339()
}
