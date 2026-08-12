use crate::commands::leads::STAGES;
use crate::db::{self, documents_dir, DbState};
use crate::error::{AppError, AppResult};
use crate::models::{ActivityInput, BuyerInput, DealInput, LeadInput, TaskInput};
use crate::util::{new_id, now_iso};
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};

use super::activity::add_activity_internal;

#[tauri::command]
pub fn get_data_dir(app: AppHandle) -> AppResult<String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Other(e.to_string()))?;
    Ok(dir.to_string_lossy().to_string())
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct BackupInfo {
    pub file_name: String,
    pub path: String,
}

#[tauri::command]
pub fn backup_now(app: AppHandle, db: State<DbState>) -> AppResult<BackupInfo> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Other(e.to_string()))?;
    let conn = db.0.lock().unwrap();
    let path = db::create_backup(&app_data_dir, &conn)?;
    Ok(BackupInfo {
        file_name: path.file_name().unwrap().to_string_lossy().to_string(),
        path: path.to_string_lossy().to_string(),
    })
}

#[tauri::command]
pub fn list_backups(app: AppHandle) -> AppResult<Vec<BackupInfo>> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Other(e.to_string()))?;
    let backups = db::list_backups(&app_data_dir)?;
    Ok(backups
        .into_iter()
        .map(|(file_name, path)| BackupInfo { file_name, path })
        .collect())
}

// --- CSV export / import -------------------------------------------------

#[derive(Debug, Serialize, Deserialize)]
struct LeadCsvRow {
    stage: String,
    seller_name: String,
    phone: Option<String>,
    email: Option<String>,
    preferred_contact_method: Option<String>,
    best_time_to_call: Option<String>,
    address: Option<String>,
    city: Option<String>,
    state: Option<String>,
    zip: Option<String>,
    parcel_number: Option<String>,
    property_type: Option<String>,
    bedrooms: Option<i64>,
    bathrooms: Option<f64>,
    square_footage: Option<i64>,
    year_built: Option<i64>,
    occupancy: Option<String>,
    reason_for_selling: Option<String>,
    desired_timeline: Option<String>,
    asking_price: Option<f64>,
    mortgage_balance: Option<f64>,
    known_liens: Option<String>,
    unpaid_taxes: Option<f64>,
    property_condition: Option<String>,
    repairs_needed: Option<String>,
    conversation_notes: Option<String>,
    arv: Option<f64>,
    estimated_repair_costs: Option<f64>,
    mao: Option<f64>,
    offer_amount: Option<f64>,
    contract_price: Option<f64>,
    buyer_price: Option<f64>,
    estimated_assignment_fee: Option<f64>,
    lead_source: Option<String>,
    priority: String,
    last_contact_date: Option<String>,
    next_follow_up_date: Option<String>,
    assigned_user: Option<String>,
}

#[tauri::command]
pub fn export_leads_csv(db: State<DbState>, dest_path: String) -> AppResult<usize> {
    let conn = db.0.lock().unwrap();
    let sql = format!(
        "SELECT {} FROM leads ORDER BY created_at ASC",
        crate::models::Lead::COLUMNS
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt.query_map([], crate::models::Lead::from_row)?;

    let mut writer = csv::Writer::from_path(&dest_path)?;
    let mut count = 0;
    for r in rows {
        let l = r?;
        writer.serialize(LeadCsvRow {
            stage: l.stage,
            seller_name: l.seller_name,
            phone: l.phone,
            email: l.email,
            preferred_contact_method: l.preferred_contact_method,
            best_time_to_call: l.best_time_to_call,
            address: l.address,
            city: l.city,
            state: l.state,
            zip: l.zip,
            parcel_number: l.parcel_number,
            property_type: l.property_type,
            bedrooms: l.bedrooms,
            bathrooms: l.bathrooms,
            square_footage: l.square_footage,
            year_built: l.year_built,
            occupancy: l.occupancy,
            reason_for_selling: l.reason_for_selling,
            desired_timeline: l.desired_timeline,
            asking_price: l.asking_price,
            mortgage_balance: l.mortgage_balance,
            known_liens: l.known_liens,
            unpaid_taxes: l.unpaid_taxes,
            property_condition: l.property_condition,
            repairs_needed: l.repairs_needed,
            conversation_notes: l.conversation_notes,
            arv: l.arv,
            estimated_repair_costs: l.estimated_repair_costs,
            mao: l.mao,
            offer_amount: l.offer_amount,
            contract_price: l.contract_price,
            buyer_price: l.buyer_price,
            estimated_assignment_fee: l.estimated_assignment_fee,
            lead_source: l.lead_source,
            priority: l.priority,
            last_contact_date: l.last_contact_date,
            next_follow_up_date: l.next_follow_up_date,
            assigned_user: l.assigned_user,
        })?;
        count += 1;
    }
    writer.flush()?;
    Ok(count)
}

fn insert_csv_row(conn: &Connection, row: LeadCsvRow) -> AppResult<()> {
    if row.seller_name.trim().is_empty() {
        return Ok(()); // skip blank/invalid rows silently
    }
    let stage = if STAGES.contains(&row.stage.as_str()) {
        row.stage
    } else {
        "new_lead".to_string()
    };
    let priority = if ["low", "medium", "high"].contains(&row.priority.as_str()) {
        row.priority
    } else {
        "medium".to_string()
    };

    let id = new_id();
    let now = now_iso();
    let max_order: f64 = conn
        .query_row(
            "SELECT COALESCE(MAX(stage_order), 0) + 1 FROM leads WHERE stage = ?1",
            params![stage],
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
            ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8,
            ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19,
            ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28,
            ?29, ?30, ?31, ?32, ?33, ?34, ?35,
            ?36, ?37, ?38, ?39, ?40, ?41, ?41
        )",
        params![
            id, stage, max_order, row.seller_name, row.phone, row.email, row.preferred_contact_method, row.best_time_to_call,
            row.address, row.city, row.state, row.zip, row.parcel_number, row.property_type, row.bedrooms, row.bathrooms, row.square_footage, row.year_built, row.occupancy,
            row.reason_for_selling, row.desired_timeline, row.asking_price, row.mortgage_balance, row.known_liens, row.unpaid_taxes, row.property_condition, row.repairs_needed, row.conversation_notes,
            row.arv, row.estimated_repair_costs, row.mao, row.offer_amount, row.contract_price, row.buyer_price, row.estimated_assignment_fee,
            row.lead_source, priority, row.last_contact_date, row.next_follow_up_date, row.assigned_user, now,
        ],
    )?;

    add_activity_internal(
        conn,
        &id,
        ActivityInput {
            activity_type: "note".into(),
            description: "Imported from CSV".into(),
            metadata: None,
        },
    )?;

    Ok(())
}

#[tauri::command]
pub fn import_leads_csv(db: State<DbState>, source_path: String) -> AppResult<usize> {
    let conn = db.0.lock().unwrap();
    let mut reader = csv::Reader::from_path(&source_path)?;
    let mut count = 0;
    for result in reader.deserialize::<LeadCsvRow>() {
        let row = result?;
        insert_csv_row(&conn, row)?;
        count += 1;
    }
    Ok(count)
}

// --- Sample data / reset --------------------------------------------------

#[tauri::command]
pub fn seed_sample_data(db: State<DbState>) -> AppResult<usize> {
    let conn = db.0.lock().unwrap();

    let sample_leads: Vec<(&str, LeadInput)> = vec![
        (
            "new_lead",
            LeadInput {
                seller_name: "Maria Gonzalez".into(),
                phone: Some("555-201-3344".into()),
                email: Some("maria.g@example.com".into()),
                preferred_contact_method: Some("phone".into()),
                best_time_to_call: Some("Evenings".into()),
                address: Some("142 Willow St".into()),
                city: Some("Springfield".into()),
                state: Some("IL".into()),
                zip: Some("62701".into()),
                parcel_number: Some("14-22-301-004".into()),
                property_type: Some("Single Family".into()),
                bedrooms: Some(3),
                bathrooms: Some(1.5),
                square_footage: Some(1450),
                year_built: Some(1978),
                occupancy: Some("occupied".into()),
                reason_for_selling: Some("Relocating for work".into()),
                desired_timeline: Some("30-60 days".into()),
                asking_price: Some(145000.0),
                mortgage_balance: Some(62000.0),
                known_liens: None,
                unpaid_taxes: None,
                property_condition: Some("Fair, needs cosmetic work".into()),
                repairs_needed: Some("Flooring, paint, roof in ~5 years".into()),
                conversation_notes: Some("Inbound from Facebook ad, motivated but not urgent.".into()),
                arv: Some(190000.0),
                estimated_repair_costs: Some(18000.0),
                mao: Some(115000.0),
                offer_amount: None,
                contract_price: None,
                buyer_price: None,
                estimated_assignment_fee: None,
                lead_source: Some("Facebook Ad".into()),
                priority: "medium".into(),
                last_contact_date: None,
                next_follow_up_date: Some(chrono::Utc::now().format("%Y-%m-%d").to_string()),
                assigned_user: Some("You".into()),
            },
        ),
        (
            "contacted",
            LeadInput {
                seller_name: "Tom Whitfield".into(),
                phone: Some("555-887-1290".into()),
                email: None,
                preferred_contact_method: Some("text".into()),
                best_time_to_call: Some("Afternoons".into()),
                address: Some("889 Cedar Ave".into()),
                city: Some("Springfield".into()),
                state: Some("IL".into()),
                zip: Some("62704".into()),
                parcel_number: None,
                property_type: Some("Single Family".into()),
                bedrooms: Some(4),
                bathrooms: Some(2.0),
                square_footage: Some(1900),
                year_built: Some(1965),
                occupancy: Some("vacant".into()),
                reason_for_selling: Some("Inherited property".into()),
                desired_timeline: Some("ASAP".into()),
                asking_price: Some(120000.0),
                mortgage_balance: None,
                known_liens: Some("Small county lien - verifying".into()),
                unpaid_taxes: Some(3200.0),
                property_condition: Some("Poor - needs full rehab".into()),
                repairs_needed: Some("Roof, HVAC, kitchen, bathrooms".into()),
                conversation_notes: Some("Left voicemail, sent follow-up text.".into()),
                arv: Some(210000.0),
                estimated_repair_costs: Some(55000.0),
                mao: Some(97000.0),
                offer_amount: None,
                contract_price: None,
                buyer_price: None,
                estimated_assignment_fee: None,
                lead_source: Some("Direct Mail".into()),
                priority: "high".into(),
                last_contact_date: Some(chrono::Utc::now().format("%Y-%m-%d").to_string()),
                next_follow_up_date: Some(chrono::Utc::now().format("%Y-%m-%d").to_string()),
                assigned_user: Some("You".into()),
            },
        ),
        (
            "offer_sent",
            LeadInput {
                seller_name: "Deborah Ellis".into(),
                phone: Some("555-402-7788".into()),
                email: Some("d.ellis@example.com".into()),
                preferred_contact_method: Some("email".into()),
                best_time_to_call: None,
                address: Some("27 Magnolia Ct".into()),
                city: Some("Decatur".into()),
                state: Some("IL".into()),
                zip: Some("62521".into()),
                parcel_number: Some("09-14-120-018".into()),
                property_type: Some("Duplex".into()),
                bedrooms: Some(4),
                bathrooms: Some(2.0),
                square_footage: Some(2200),
                year_built: Some(1958),
                occupancy: Some("occupied".into()),
                reason_for_selling: Some("Tired landlord".into()),
                desired_timeline: Some("60-90 days".into()),
                asking_price: Some(135000.0),
                mortgage_balance: Some(40000.0),
                known_liens: None,
                unpaid_taxes: None,
                property_condition: Some("Fair".into()),
                repairs_needed: Some("Exterior paint, unit B bathroom".into()),
                conversation_notes: Some("Sent cash offer at $102,000.".into()),
                arv: Some(180000.0),
                estimated_repair_costs: Some(20000.0),
                mao: Some(106000.0),
                offer_amount: Some(102000.0),
                contract_price: None,
                buyer_price: None,
                estimated_assignment_fee: None,
                lead_source: Some("Cold Call".into()),
                priority: "high".into(),
                last_contact_date: Some(chrono::Utc::now().format("%Y-%m-%d").to_string()),
                next_follow_up_date: Some(chrono::Utc::now().format("%Y-%m-%d").to_string()),
                assigned_user: Some("You".into()),
            },
        ),
        (
            "under_contract",
            LeadInput {
                seller_name: "James Park".into(),
                phone: Some("555-663-9012".into()),
                email: Some("jpark@example.com".into()),
                preferred_contact_method: Some("phone".into()),
                best_time_to_call: Some("Mornings".into()),
                address: Some("501 Birchwood Dr".into()),
                city: Some("Champaign".into()),
                state: Some("IL".into()),
                zip: Some("61820".into()),
                parcel_number: Some("31-08-450-002".into()),
                property_type: Some("Single Family".into()),
                bedrooms: Some(3),
                bathrooms: Some(2.0),
                square_footage: Some(1600),
                year_built: Some(1985),
                occupancy: Some("vacant".into()),
                reason_for_selling: Some("Facing foreclosure".into()),
                desired_timeline: Some("ASAP".into()),
                asking_price: Some(98000.0),
                mortgage_balance: Some(88000.0),
                known_liens: None,
                unpaid_taxes: Some(1800.0),
                property_condition: Some("Fair".into()),
                repairs_needed: Some("Minor repairs".into()),
                conversation_notes: Some("Signed purchase agreement.".into()),
                arv: Some(160000.0),
                estimated_repair_costs: Some(15000.0),
                mao: Some(97000.0),
                offer_amount: Some(93000.0),
                contract_price: Some(93000.0),
                buyer_price: Some(108000.0),
                estimated_assignment_fee: Some(15000.0),
                lead_source: Some("Driving for Dollars".into()),
                priority: "high".into(),
                last_contact_date: Some(chrono::Utc::now().format("%Y-%m-%d").to_string()),
                next_follow_up_date: None,
                assigned_user: Some("You".into()),
            },
        ),
        (
            "dead_lead",
            LeadInput {
                seller_name: "Karen Sutton".into(),
                phone: Some("555-101-2020".into()),
                email: None,
                preferred_contact_method: Some("phone".into()),
                best_time_to_call: None,
                address: Some("77 Oak Ridge Rd".into()),
                city: Some("Peoria".into()),
                state: Some("IL".into()),
                zip: Some("61602".into()),
                parcel_number: None,
                property_type: Some("Single Family".into()),
                bedrooms: Some(3),
                bathrooms: Some(1.0),
                square_footage: Some(1200),
                year_built: Some(1970),
                occupancy: Some("occupied".into()),
                reason_for_selling: Some("Just testing the market".into()),
                desired_timeline: Some("Not in a hurry".into()),
                asking_price: Some(160000.0),
                mortgage_balance: None,
                known_liens: None,
                unpaid_taxes: None,
                property_condition: Some("Good".into()),
                repairs_needed: None,
                conversation_notes: Some("Wants full retail price, not motivated. Passed.".into()),
                arv: Some(165000.0),
                estimated_repair_costs: Some(5000.0),
                mao: Some(110000.0),
                offer_amount: None,
                contract_price: None,
                buyer_price: None,
                estimated_assignment_fee: None,
                lead_source: Some("Zillow FSBO".into()),
                priority: "low".into(),
                last_contact_date: Some(chrono::Utc::now().format("%Y-%m-%d").to_string()),
                next_follow_up_date: None,
                assigned_user: Some("You".into()),
            },
        ),
    ];

    let mut count = 0;
    for (stage, input) in sample_leads {
        let id = new_id();
        let now = now_iso();
        let max_order: f64 = conn
            .query_row(
                "SELECT COALESCE(MAX(stage_order), 0) + 1 FROM leads WHERE stage = ?1",
                params![stage],
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
                ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8,
                ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19,
                ?20, ?21, ?22, ?23, ?24, ?25, ?26, ?27, ?28,
                ?29, ?30, ?31, ?32, ?33, ?34, ?35,
                ?36, ?37, ?38, ?39, ?40, ?41, ?41
            )",
            params![
                id, stage, max_order, input.seller_name, input.phone, input.email, input.preferred_contact_method, input.best_time_to_call,
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
                description: "Sample lead created".into(),
                metadata: None,
            },
        )?;

        if stage == "under_contract" {
            super::deals::ensure_deal_for_lead(&conn, &id)?;
            let deal_input = DealInput {
                contract_date: Some(chrono::Utc::now().format("%Y-%m-%d").to_string()),
                earnest_money_amount: Some(1000.0),
                earnest_money_due_date: Some(
                    (chrono::Utc::now() + chrono::Duration::days(3))
                        .format("%Y-%m-%d")
                        .to_string(),
                ),
                inspection_period_end_date: Some(
                    (chrono::Utc::now() + chrono::Duration::days(10))
                        .format("%Y-%m-%d")
                        .to_string(),
                ),
                closing_date: Some(
                    (chrono::Utc::now() + chrono::Duration::days(25))
                        .format("%Y-%m-%d")
                        .to_string(),
                ),
                title_company_name: Some("Prairie State Title Co.".into()),
                title_company_phone: Some("555-900-1000".into()),
                title_company_email: Some("closings@prairiestatetitle.example".into()),
                end_buyer_id: None,
                end_buyer_name: None,
                buyer_deposit: None,
                assignment_fee: Some(15000.0),
                title_status: "search_in_progress".into(),
                closing_status: "pending".into(),
                deal_notes: Some("Actively marketing to buyer list.".into()),
            };
            let now2 = now_iso();
            conn.execute(
                "UPDATE deals SET contract_date=?2, earnest_money_amount=?3, earnest_money_due_date=?4, inspection_period_end_date=?5, closing_date=?6, title_company_name=?7, title_company_phone=?8, title_company_email=?9, assignment_fee=?10, title_status=?11, closing_status=?12, deal_notes=?13, updated_at=?14 WHERE lead_id=?1",
                params![id, deal_input.contract_date, deal_input.earnest_money_amount, deal_input.earnest_money_due_date, deal_input.inspection_period_end_date, deal_input.closing_date, deal_input.title_company_name, deal_input.title_company_phone, deal_input.title_company_email, deal_input.assignment_fee, deal_input.title_status, deal_input.closing_status, deal_input.deal_notes, now2],
            )?;
        }
        count += 1;
    }

    let sample_buyers = vec![
        BuyerInput {
            buyer_name: "Alan Brooks".into(),
            company_name: Some("Brooks Capital LLC".into()),
            phone: Some("555-330-4455".into()),
            email: Some("alan@brookscapital.example".into()),
            areas: Some("Springfield, Decatur, Champaign".into()),
            property_types: Some("Single Family, Duplex".into()),
            max_purchase_price: Some(150000.0),
            max_repair_level: Some("Moderate rehab".into()),
            funding_type: "cash".into(),
            proof_of_funds_status: Some("Verified on file".into()),
            typical_closing_speed: Some("7-10 days".into()),
            preferred_title_company: Some("Prairie State Title Co.".into()),
            notes: Some("Buys 3-4 properties per month, fast communicator.".into()),
            previous_deals: vec![],
        },
        BuyerInput {
            buyer_name: "Nina Patel".into(),
            company_name: Some("Patel Home Holdings".into()),
            phone: Some("555-771-2233".into()),
            email: Some("nina@patelholdings.example".into()),
            areas: Some("Peoria, Springfield".into()),
            property_types: Some("Single Family".into()),
            max_purchase_price: Some(120000.0),
            max_repair_level: Some("Light to moderate".into()),
            funding_type: "cash".into(),
            proof_of_funds_status: Some("Requested".into()),
            typical_closing_speed: Some("14 days".into()),
            preferred_title_company: None,
            notes: Some("Prefers turnkey or light rehab only.".into()),
            previous_deals: vec![],
        },
        BuyerInput {
            buyer_name: "Marcus Reid".into(),
            company_name: Some("Reid Property Group".into()),
            phone: Some("555-990-6677".into()),
            email: Some("marcus@reidpg.example".into()),
            areas: Some("Champaign, Decatur, Bloomington".into()),
            property_types: Some("Single Family, Duplex, Small Multifamily".into()),
            max_purchase_price: Some(220000.0),
            max_repair_level: Some("Heavy rehab OK".into()),
            funding_type: "both".into(),
            proof_of_funds_status: Some("Verified on file".into()),
            typical_closing_speed: Some("5-7 days".into()),
            preferred_title_company: Some("Prairie State Title Co.".into()),
            notes: Some("High-volume buyer, very reliable.".into()),
            previous_deals: vec![],
        },
    ];
    for buyer in sample_buyers {
        let id = new_id();
        let now = now_iso();
        conn.execute(
            "INSERT INTO buyers (
                id, buyer_name, company_name, phone, email, areas, property_types,
                max_purchase_price, max_repair_level, funding_type, proof_of_funds_status,
                typical_closing_speed, preferred_title_company, notes, created_at, updated_at
            ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?15)",
            params![
                id, buyer.buyer_name, buyer.company_name, buyer.phone, buyer.email, buyer.areas, buyer.property_types,
                buyer.max_purchase_price, buyer.max_repair_level, buyer.funding_type, buyer.proof_of_funds_status,
                buyer.typical_closing_speed, buyer.preferred_title_company, buyer.notes, now,
            ],
        )?;
        count += 1;
    }

    let sample_tasks = vec![
        TaskInput {
            lead_id: None,
            task_type: "other".into(),
            title: "Review new inbound leads".into(),
            notes: Some("Check ad platforms for overnight leads.".into()),
            due_date: chrono::Utc::now().format("%Y-%m-%d").to_string(),
        },
        TaskInput {
            lead_id: None,
            task_type: "appointment".into(),
            title: "Call buyers list about new deal".into(),
            notes: None,
            due_date: (chrono::Utc::now() + chrono::Duration::days(1))
                .format("%Y-%m-%d")
                .to_string(),
        },
    ];
    for task in sample_tasks {
        let id = new_id();
        let now = now_iso();
        conn.execute(
            "INSERT INTO tasks (id, lead_id, task_type, title, notes, due_date, completed, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, 0, ?7)",
            params![id, task.lead_id, task.task_type, task.title, task.notes, task.due_date, now],
        )?;
        count += 1;
    }

    Ok(count)
}

#[tauri::command]
pub fn reset_all_data(app: AppHandle, db: State<DbState>) -> AppResult<()> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::Other(e.to_string()))?;
    let conn = db.0.lock().unwrap();

    // Safety net: always snapshot before a destructive reset.
    db::create_backup(&app_data_dir, &conn)?;

    conn.execute("DELETE FROM leads", [])?;
    conn.execute("DELETE FROM buyers", [])?;
    conn.execute("DELETE FROM tasks", [])?;

    let docs_dir = documents_dir(&app_data_dir);
    if docs_dir.exists() {
        std::fs::remove_dir_all(&docs_dir)?;
    }
    std::fs::create_dir_all(&docs_dir)?;

    Ok(())
}
