"use client";

import { useRef, useState } from "react";
import { IconUpload } from "@tabler/icons-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { apiFetch } from "@/lib/api";

type ImportFilePayload = { fileName: string; dataBase64: string };

type ImportReport = {
  updated: Array<{ projectId: string; projectName: string; excelName: string }>;
  skippedUnmatched: string[];
  ambiguous: Array<{ excelName: string; candidates: string[] }>;
  errors: string[];
};

async function fileToBase64(file: File): Promise<ImportFilePayload> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return { fileName: file.name, dataBase64: btoa(binary) };
}

export function UpdateFactoryPricesButton({ onDone }: { onDone?: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [modularFile, setModularFile] = useState<File | null>(null);
  const [panelFile, setPanelFile] = useState<File | null>(null);
  const modularRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLInputElement>(null);

  function resetFiles() {
    setModularFile(null);
    setPanelFile(null);
    if (modularRef.current) modularRef.current.value = "";
    if (panelRef.current) panelRef.current.value = "";
  }

  async function submit() {
    if (!modularFile && !panelFile) {
      toast.error("Выберите хотя бы один Excel-файл");
      return;
    }

    setBusy(true);
    try {
      const body: {
        modular?: ImportFilePayload;
        panelFrame?: ImportFilePayload;
      } = {};
      if (modularFile) body.modular = await fileToBase64(modularFile);
      if (panelFile) body.panelFrame = await fileToBase64(panelFile);

      const report = await apiFetch<ImportReport>("/api/company/catalog/prices/import", {
        method: "POST",
        body: JSON.stringify(body)
      });

      const parts = [
        `обновлено ${report.updated.length}`,
        `пропущено (нет в каталоге) ${report.skippedUnmatched.length}`,
        `спорных ${report.ambiguous.length}`
      ];
      if (report.errors.length > 0) {
        toast.warning(`Цены: ${parts.join(", ")}. Ошибки: ${report.errors.join("; ")}`);
      } else {
        toast.success(`Цены обновлены: ${parts.join(", ")}`);
      }

      setOpen(false);
      resetFiles();
      onDone?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось обновить цены");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <IconUpload className="size-4" />
        Обновить цены
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (busy) return;
          setOpen(next);
          if (!next) resetFiles();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Обновить заводские цены</DialogTitle>
            <DialogDescription>
              Загрузите прайсы Excel (модульные и/или ПКД). Обновятся только проекты, которые
              уже есть в каталоге. Цена дома защитится от перезаписи синком Tilda.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="price-modular">Модульные дома</Label>
              <Input
                id="price-modular"
                ref={modularRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => setModularFile(e.target.files?.[0] ?? null)}
              />
              {modularFile ? (
                <p className="text-muted-foreground truncate text-xs">{modularFile.name}</p>
              ) : null}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="price-panel">Панельно-каркасные (ПКД)</Label>
              <Input
                id="price-panel"
                ref={panelRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => setPanelFile(e.target.files?.[0] ?? null)}
              />
              {panelFile ? (
                <p className="text-muted-foreground truncate text-xs">{panelFile.name}</p>
              ) : null}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" disabled={busy} onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <Button type="button" disabled={busy} onClick={() => void submit()}>
              {busy ? <Spinner className="size-4" /> : <IconUpload className="size-4" />}
              {busy ? "Загрузка…" : "Обновить"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
