// Supabase database type definitions
// In production, generate this with: npx supabase gen types typescript --linked
// For now, manual definitions matching the migration SQL.

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type Database = {
  public: {
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          full_name: string | null;
          timezone: string;
          daily_work_target_minutes: number;
          sunday_work_target_minutes: number;
          web_search_mode: "auto" | "ask" | "manual" | "disabled";
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["profiles"]["Row"]> & { id: string };
        Update: Partial<Database["public"]["Tables"]["profiles"]["Row"]>;
      };
      company_settings: {
        Row: {
          id: string;
          user_id: string;
          company_name: string;
          thirty_day_revenue_target: number;
          ai_monthly_token_limit: number;
          ai_tokens_used_this_month: number;
          ai_token_month_reset: string;
          notification_quiet_start: string;
          notification_quiet_end: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["company_settings"]["Row"]> & { user_id: string };
        Update: Partial<Database["public"]["Tables"]["company_settings"]["Row"]>;
      };
      leads: {
        Row: {
          id: string;
          user_id: string;
          stage: string;
          stage_order: number;
          seller_name: string;
          phone: string | null;
          email: string | null;
          preferred_contact_method: string | null;
          best_time_to_call: string | null;
          address: string | null;
          city: string | null;
          state: string | null;
          zip: string | null;
          parcel_number: string | null;
          property_type: string | null;
          bedrooms: number | null;
          bathrooms: number | null;
          square_footage: number | null;
          year_built: number | null;
          occupancy: string | null;
          reason_for_selling: string | null;
          desired_timeline: string | null;
          asking_price: number | null;
          mortgage_balance: number | null;
          known_liens: string | null;
          unpaid_taxes: number | null;
          property_condition: string | null;
          repairs_needed: string | null;
          conversation_notes: string | null;
          arv: number | null;
          estimated_repair_costs: number | null;
          mao: number | null;
          offer_amount: number | null;
          contract_price: number | null;
          buyer_price: number | null;
          estimated_assignment_fee: number | null;
          lead_source: string | null;
          priority: "low" | "medium" | "high";
          last_contact_date: string | null;
          next_follow_up_date: string | null;
          assigned_user: string | null;
          disposition:
            | "under_contract"
            | "follow_up"
            | "not_interested"
            | "bad_lead"
            | "no_response"
            | "wrong_information"
            | "sold"
            | "other"
            | null;
          disposition_reason: string | null;
          disposition_notes: string | null;
          disposed_at: string | null;
          import_batch_id: string | null;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["leads"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["leads"]["Row"]>;
      };
      import_batches: {
        Row: {
          id: string;
          user_id: string;
          conversation_id: string | null;
          source_filename: string;
          file_type: "csv" | "xlsx" | "pdf" | "txt";
          storage_path: string | null;
          file_size_bytes: number | null;
          status: "staged" | "processing" | "completed" | "failed";
          column_mapping: Json;
          parsed_rows: Json;
          total_rows: number;
          imported_count: number;
          duplicate_count: number;
          skipped_count: number;
          skipped_reasons: Json;
          error_message: string | null;
          created_at: string;
          processed_at: string | null;
        };
        Insert: Omit<Database["public"]["Tables"]["import_batches"]["Row"], "id" | "created_at"> & {
          id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["import_batches"]["Row"]>;
      };
      buyers: {
        Row: {
          id: string;
          user_id: string;
          buyer_name: string;
          company_name: string | null;
          phone: string | null;
          email: string | null;
          areas: string | null;
          property_types: string | null;
          max_purchase_price: number | null;
          max_repair_level: string | null;
          funding_type: "cash" | "financing" | "both";
          proof_of_funds_status: string | null;
          typical_closing_speed: string | null;
          preferred_title_company: string | null;
          notes: string | null;
          status: "active" | "inactive" | "do_not_contact";
          last_contact_date: string | null;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["buyers"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["buyers"]["Row"]>;
      };
      deals: {
        Row: {
          id: string;
          user_id: string;
          lead_id: string;
          contract_date: string | null;
          earnest_money_amount: number | null;
          earnest_money_due_date: string | null;
          inspection_period_end_date: string | null;
          closing_date: string | null;
          title_company_name: string | null;
          title_company_phone: string | null;
          title_company_email: string | null;
          end_buyer_id: string | null;
          end_buyer_name: string | null;
          buyer_deposit: number | null;
          assignment_fee: number | null;
          title_status: string;
          closing_status: string;
          deal_stage:
            | "analyzing"
            | "negotiating"
            | "under_contract"
            | "finding_buyer"
            | "assigned"
            | "closing"
            | "closed"
            | "dead";
          deal_notes: string | null;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["deals"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["deals"]["Row"]>;
      };
      tasks: {
        Row: {
          id: string;
          user_id: string;
          lead_id: string | null;
          task_type: string;
          title: string;
          notes: string | null;
          due_date: string | null;
          objective_id: string | null;
          buyer_id: string | null;
          deal_id: string | null;
          category: string | null;
          priority: "low" | "medium" | "high" | "critical" | null;
          is_revenue_producing: boolean;
          is_non_negotiable: boolean;
          status: string;
          estimated_minutes: number | null;
          actual_minutes: number | null;
          scheduled_start: string | null;
          scheduled_end: string | null;
          completion_pct: number | null;
          proof_type:
            | "screenshot"
            | "file"
            | "url"
            | "written"
            | "number"
            | "call_count"
            | "crm_activity"
            | "summary"
            | "other"
            | null;
          proof_status: "not_required" | "pending_review" | "approved" | "rejected";
          proof_required: string | null;
          proof_submitted: string | null;
          proof_submitted_at: string | null;
          proof_rejection_reason: string | null;
          proof_file_paths: Json;
          generated_by: "user" | "big_stein";
          replaced_task_id: string | null;
          blocker_description: string | null;
          blocker_type: string | null;
          big_stein_notes: string | null;
          reschedule_history: Json;
          completed: boolean;
          completed_at: string | null;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["tasks"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tasks"]["Row"]>;
      };
      objectives: {
        Row: {
          id: string;
          user_id: string;
          parent_id: string | null;
          level: number;
          title: string;
          description: string | null;
          why_it_matters: string | null;
          success_criteria: string | null;
          status: "not_started" | "in_progress" | "completed" | "paused" | "cancelled";
          progress_pct: number;
          start_date: string | null;
          end_date: string | null;
          revenue_target: number | null;
          revenue_actual: number | null;
          big_stein_evaluation: string | null;
          notes: string | null;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["objectives"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["objectives"]["Row"]>;
      };
      revenue_targets: {
        Row: {
          id: string;
          user_id: string;
          period_type: "thirty_day" | "monthly" | "quarterly" | "annual";
          period_start: string;
          period_end: string;
          target_minimum: number | null;
          target_main: number;
          target_stretch: number | null;
          collected: number;
          closed_awaiting_collection: number;
          contracted_awaiting_closing: number;
          projected_pipeline: number;
          total_expenses: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["revenue_targets"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["revenue_targets"]["Row"]>;
      };
      workdays: {
        Row: {
          id: string;
          user_id: string;
          work_date: string;
          clocked_in_at: string | null;
          clocked_out_at: string | null;
          target_minutes: number;
          actual_minutes: number;
          day_score: number | null;
          day_score_explanation: string | null;
          daily_notes: string | null;
          eod_review_generated_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["workdays"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["workdays"]["Row"]>;
      };
      time_entries: {
        Row: {
          id: string;
          user_id: string;
          workday_id: string;
          task_id: string | null;
          lead_id: string | null;
          deal_id: string | null;
          started_at: string;
          ended_at: string | null;
          duration_minutes: number | null;
          category: string;
          is_productive: boolean;
          is_revenue_producing: boolean;
          notes: string | null;
          device: string | null;
          edited_at: string | null;
          edit_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["time_entries"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["time_entries"]["Row"]>;
      };
      chat_conversations: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          archived: boolean;
          total_tokens: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["chat_conversations"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["chat_conversations"]["Row"]>;
      };
      chat_messages: {
        Row: {
          id: string;
          conversation_id: string;
          user_id: string;
          role: "user" | "assistant" | "system";
          content: string;
          tool_calls: Json | null;
          tool_results: Json | null;
          web_sources: Json | null;
          contains_assumptions: boolean;
          input_tokens: number | null;
          output_tokens: number | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["chat_messages"]["Row"], "id" | "created_at"> & {
          id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["chat_messages"]["Row"]>;
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          device_label: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["push_subscriptions"]["Row"], "id" | "created_at" | "updated_at"> & {
          id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["push_subscriptions"]["Row"]>;
      };
    };
  };
};
