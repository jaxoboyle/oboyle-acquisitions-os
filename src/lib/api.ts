import { invoke } from "@tauri-apps/api/core";
import type {
  ActivityEntry,
  ActivityInput,
  BackupInfo,
  Buyer,
  BuyerInput,
  DashboardStats,
  Deal,
  DealInput,
  DealWithLead,
  Document,
  Lead,
  LeadInput,
  Task,
  TaskInput,
  TaskWithLead,
} from "./types";

export const api = {
  leads: {
    list: () => invoke<Lead[]>("leads_list"),
    get: (id: string) => invoke<Lead>("leads_get", { id }),
    create: (input: LeadInput) => invoke<Lead>("leads_create", { input }),
    update: (id: string, input: LeadInput) => invoke<Lead>("leads_update", { id, input }),
    delete: (id: string) => invoke<void>("leads_delete", { id }),
    moveStage: (id: string, stage: string, stageOrder: number) =>
      invoke<Lead>("leads_move_stage", { id, stage, stageOrder }),
  },
  buyers: {
    list: () => invoke<Buyer[]>("buyers_list"),
    create: (input: BuyerInput) => invoke<Buyer>("buyers_create", { input }),
    update: (id: string, input: BuyerInput) => invoke<Buyer>("buyers_update", { id, input }),
    delete: (id: string) => invoke<void>("buyers_delete", { id }),
  },
  deals: {
    list: () => invoke<DealWithLead[]>("deals_list"),
    getByLead: (leadId: string) => invoke<DealWithLead | null>("deals_get_by_lead", { leadId }),
    upsert: (leadId: string, input: DealInput) =>
      invoke<Deal>("deals_upsert", { leadId, input }),
  },
  documents: {
    list: (leadId: string) => invoke<Document[]>("documents_list", { leadId }),
    add: (leadId: string, category: string, sourcePath: string) =>
      invoke<Document>("documents_add", { leadId, category, sourcePath }),
    delete: (id: string) => invoke<void>("documents_delete", { id }),
    absolutePath: (id: string) => invoke<string>("documents_absolute_path", { id }),
  },
  tasks: {
    list: () => invoke<TaskWithLead[]>("tasks_list"),
    create: (input: TaskInput) => invoke<Task>("tasks_create", { input }),
    update: (id: string, input: TaskInput) => invoke<Task>("tasks_update", { id, input }),
    setCompleted: (id: string, completed: boolean) =>
      invoke<Task>("tasks_set_completed", { id, completed }),
    delete: (id: string) => invoke<void>("tasks_delete", { id }),
  },
  activity: {
    list: (leadId: string) => invoke<ActivityEntry[]>("activity_list", { leadId }),
    add: (leadId: string, input: ActivityInput) =>
      invoke<ActivityEntry>("activity_add", { leadId, input }),
  },
  dashboard: {
    stats: () => invoke<DashboardStats>("dashboard_stats"),
  },
  data: {
    getDataDir: () => invoke<string>("get_data_dir"),
    backupNow: () => invoke<BackupInfo>("backup_now"),
    listBackups: () => invoke<BackupInfo[]>("list_backups"),
    exportLeadsCsv: (destPath: string) => invoke<number>("export_leads_csv", { destPath }),
    importLeadsCsv: (sourcePath: string) => invoke<number>("import_leads_csv", { sourcePath }),
    seedSampleData: () => invoke<number>("seed_sample_data"),
    resetAllData: () => invoke<void>("reset_all_data"),
  },
};
