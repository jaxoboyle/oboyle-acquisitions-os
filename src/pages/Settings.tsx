import { useState } from "react";
import { open as openFileDialog, save as saveFileDialog } from "@tauri-apps/plugin-dialog";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DatabaseBackup,
  Download,
  Upload,
  FolderOpen,
  Sparkles,
  Trash2,
  Sun,
  Moon,
} from "lucide-react";
import { api } from "@/lib/api";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { useTheme } from "@/lib/theme";
import { errorMessage, toastError, toastSuccess } from "@/lib/toast";
import { cn } from "@/lib/utils";

export function Settings() {
  const { theme, setTheme } = useTheme();
  const qc = useQueryClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const { data: dataDir } = useQuery({ queryKey: ["dataDir"], queryFn: api.data.getDataDir });
  const { data: backups, refetch: refetchBackups } = useQuery({
    queryKey: ["backups"],
    queryFn: api.data.listBackups,
  });

  async function handleBackupNow() {
    setBusy("backup");
    try {
      const info = await api.data.backupNow();
      toastSuccess(`Backup saved: ${info.fileName}`);
      refetchBackups();
    } catch (e) {
      toastError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function handleExport() {
    try {
      const dest = await saveFileDialog({
        defaultPath: "leads-export.csv",
        filters: [{ name: "CSV", extensions: ["csv"] }],
      });
      if (!dest) return;
      setBusy("export");
      const count = await api.data.exportLeadsCsv(dest);
      toastSuccess(`Exported ${count} lead${count === 1 ? "" : "s"} to CSV`);
    } catch (e) {
      toastError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function handleImport() {
    try {
      const source = await openFileDialog({
        multiple: false,
        filters: [{ name: "CSV", extensions: ["csv"] }],
      });
      if (!source || Array.isArray(source)) return;
      setBusy("import");
      const count = await api.data.importLeadsCsv(source);
      toastSuccess(`Imported ${count} lead${count === 1 ? "" : "s"}`);
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (e) {
      toastError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function handleSeed() {
    setBusy("seed");
    try {
      const count = await api.data.seedSampleData();
      toastSuccess(`Added ${count} sample records`);
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["buyers"] });
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (e) {
      toastError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function handleReset() {
    setConfirmReset(false);
    setBusy("reset");
    try {
      await api.data.resetAllData();
      toastSuccess("All data cleared. A backup was saved first.");
      qc.invalidateQueries();
      refetchBackups();
    } catch (e) {
      toastError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-text">Settings</h1>
        <p className="text-sm text-text-muted">Appearance, backups, and data management.</p>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
          </CardHeader>
          <CardBody className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-text">Theme</div>
              <div className="text-[12.5px] text-text-muted">Choose light or dark mode.</div>
            </div>
            <div className="flex gap-1 rounded-md border border-border p-0.5">
              <button
                onClick={() => setTheme("light")}
                className={cn(
                  "flex items-center gap-1 rounded px-2.5 py-1 text-[12.5px] font-medium",
                  theme === "light" ? "bg-accent-soft text-accent" : "text-text-muted",
                )}
              >
                <Sun size={13} /> Light
              </button>
              <button
                onClick={() => setTheme("dark")}
                className={cn(
                  "flex items-center gap-1 rounded px-2.5 py-1 text-[12.5px] font-medium",
                  theme === "dark" ? "bg-accent-soft text-accent" : "text-text-muted",
                )}
              >
                <Moon size={13} /> Dark
              </button>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Backups</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-text">Automatic backups</div>
                <div className="text-[12.5px] text-text-muted">
                  A backup is created automatically every time the app starts.
                </div>
              </div>
              <Button variant="secondary" onClick={handleBackupNow} disabled={busy === "backup"}>
                <DatabaseBackup size={14} /> {busy === "backup" ? "Backing up..." : "Back Up Now"}
              </Button>
            </div>
            {backups && backups.length > 0 && (
              <div className="max-h-40 overflow-y-auto rounded-md border border-border">
                {backups.slice(0, 10).map((b) => (
                  <div
                    key={b.path}
                    className="flex items-center justify-between border-b border-border px-3 py-2 text-[12.5px] last:border-0"
                  >
                    <span className="truncate text-text">{b.fileName}</span>
                  </div>
                ))}
              </div>
            )}
            {dataDir && (
              <div className="mt-3 flex items-center gap-1.5 text-[12px] text-text-muted">
                <FolderOpen size={12} />
                <span className="truncate">Data stored at: {dataDir}</span>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Import & Export</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={handleExport} disabled={busy === "export"}>
              <Download size={14} /> {busy === "export" ? "Exporting..." : "Export Leads to CSV"}
            </Button>
            <Button variant="secondary" onClick={handleImport} disabled={busy === "import"}>
              <Upload size={14} /> {busy === "import" ? "Importing..." : "Import Leads from CSV"}
            </Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sample Data & Reset</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={handleSeed} disabled={busy === "seed"}>
              <Sparkles size={14} /> {busy === "seed" ? "Adding..." : "Load Sample Data"}
            </Button>
            <Button
              variant="danger"
              onClick={() => setConfirmReset(true)}
              disabled={busy === "reset"}
            >
              <Trash2 size={14} /> {busy === "reset" ? "Resetting..." : "Reset All Data"}
            </Button>
          </CardBody>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmReset}
        title="Reset all data?"
        description="This permanently deletes every lead, buyer, deal, task, and document. A backup is taken first, but this cannot be undone from within the app."
        confirmLabel="Reset Everything"
        onCancel={() => setConfirmReset(false)}
        onConfirm={handleReset}
      />
    </div>
  );
}
