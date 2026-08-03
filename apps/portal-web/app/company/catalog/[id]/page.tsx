"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  IconChevronLeft,
  IconExternalLink,
  IconEye,
  IconEyeOff,
  IconPhoto,
  IconStar,
  IconStarFilled
} from "@tabler/icons-react";
import { toast } from "sonner";

import { DashboardShell } from "@/components/dashboard-shell";
import { PageAlert } from "@/components/page-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";
import { TECHNOLOGY_LABELS, technologyBadgeCode, technologyBadgeVariant } from "@/lib/catalog-display";
import { companyCabinetLabel, companyNavigation } from "@/lib/company-nav";
import { cn } from "@/lib/utils";

const ASSET_TYPES = [
  { value: "exterior", label: "Экстерьер" },
  { value: "floor_plan", label: "Планировка" },
  { value: "interior", label: "Интерьер" },
  { value: "unknown", label: "Неизвестно" }
] as const;

type AssetType = (typeof ASSET_TYPES)[number]["value"];

type Asset = {
  id: string;
  sourceUrl: string;
  type: AssetType;
  floorNumber: number | null;
  sortOrder: number;
  isPrimary: boolean;
  isHidden: boolean;
};

type SyncOverrides = Partial<
  Record<
    | "name"
    | "description"
    | "technology"
    | "area"
    | "floors"
    | "bedrooms"
    | "bathrooms"
    | "basePrice"
    | "active",
    boolean
  >
>;

type Project = {
  id: string;
  name: string;
  description: string;
  technology: "modular" | "panel_frame";
  area: number | null;
  floors: number | null;
  bedrooms: number | null;
  bathrooms: string | null;
  basePrice: number | null;
  projectUrl: string;
  active: boolean;
  syncOverrides?: SyncOverrides;
  assets: Asset[];
};

const OVERRIDE_FIELD_LABELS: Record<keyof SyncOverrides, string> = {
  name: "Название",
  description: "Описание",
  technology: "Технология",
  area: "Площадь, м²",
  floors: "Этажи",
  bedrooms: "Спальни",
  bathrooms: "Санузлы",
  basePrice: "Заводская цена, ₽",
  active: "Статус"
};

function FieldLabelWithOverride({
  htmlFor,
  field,
  overrides,
  onClear
}: {
  htmlFor: string;
  field: keyof SyncOverrides;
  overrides: SyncOverrides;
  onClear: (field: keyof SyncOverrides) => void;
}) {
  const protectedBySync = overrides[field] === true;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Label htmlFor={htmlFor}>{OVERRIDE_FIELD_LABELS[field]}</Label>
      {protectedBySync ? (
        <>
          <Badge variant="outline" className="text-xs font-normal">
            защищено от синка
          </Badge>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => onClear(field)}
          >
            Сбросить
          </Button>
        </>
      ) : null}
    </div>
  );
}

export default function CompanyCatalogProjectPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [assetBusyId, setAssetBusyId] = useState<string | null>(null);
  const [technology, setTechnology] = useState<"modular" | "panel_frame">("modular");
  const [active, setActive] = useState(true);

  async function load() {
    try {
      const data = await apiFetch<Project>(`/api/company/catalog/projects/${id}`);
      setProject(data);
      setTechnology(data.technology);
      setActive(data.active);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить проект");
      setProject(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload on id
  }, [id]);

  async function saveProject(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!project) return;

    const fd = new FormData(event.currentTarget);
    const body = {
      name: String(fd.get("name") || "").trim(),
      description: String(fd.get("description") || ""),
      technology,
      area: fd.get("area") ? Number(fd.get("area")) : null,
      floors: fd.get("floors") ? Number(fd.get("floors")) : null,
      bedrooms: fd.get("bedrooms") ? Number(fd.get("bedrooms")) : null,
      bathrooms: String(fd.get("bathrooms") || "").trim() || null,
      basePrice: fd.get("basePrice") ? Number(fd.get("basePrice")) : null,
      active
    };

    setSaving(true);
    try {
      const updated = await apiFetch<Project>(`/api/company/catalog/projects/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body)
      });
      setProject(updated);
      setTechnology(updated.technology);
      setActive(updated.active);
      toast.success("Проект сохранён");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  async function patchAsset(
    assetId: string,
    body: { type?: AssetType; floorNumber?: number | null; isPrimary?: boolean; isHidden?: boolean }
  ) {
    setAssetBusyId(assetId);
    try {
      const updated = await apiFetch<Project>(`/api/company/catalog/assets/${assetId}`, {
        method: "PATCH",
        body: JSON.stringify(body)
      });
      setProject(updated);
      toast.success("Ассет обновлён");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось обновить ассет");
    } finally {
      setAssetBusyId(null);
    }
  }

  async function clearSyncOverrides(fields?: Array<keyof SyncOverrides>) {
    if (!project) return;
    try {
      const updated = await apiFetch<Project>(
        `/api/company/catalog/projects/${id}/clear-sync-overrides`,
        {
          method: "POST",
          body: JSON.stringify(fields ? { fields } : {})
        }
      );
      setProject(updated);
      setTechnology(updated.technology);
      setActive(updated.active);
      toast.success(fields ? "Защита поля сброшена" : "Защита от синка сброшена");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось сбросить защиту");
    }
  }

  const overrides = project?.syncOverrides ?? {};
  const hasAnyOverride = Object.values(overrides).some(Boolean);

  return (
    <DashboardShell
      cabinetLabel={companyCabinetLabel}
      currentPath="/company/catalog"
      navigation={companyNavigation}
    >
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/company/catalog">
            <IconChevronLeft />
            К каталогу
          </Link>
        </Button>
      </div>

      <PageAlert message={error} variant="destructive" />

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : project ? (
        <div className="space-y-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
                <Badge variant={technologyBadgeVariant(project.technology)}>
                  {technologyBadgeCode(project.technology)}
                </Badge>
                <Badge variant={project.active ? "default" : "secondary"}>
                  {project.active ? "Активен" : "Скрыт"}
                </Badge>
              </div>
              <a
                href={project.projectUrl}
                target="_blank"
                rel="noreferrer"
                className="text-muted-foreground hover:text-primary inline-flex items-center gap-1.5 text-sm"
              >
                Открыть на сайте
                <IconExternalLink className="size-3.5" />
              </a>
            </div>
          </div>

          <Card>
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
              <div className="space-y-1.5">
                <CardTitle>Описание и характеристики</CardTitle>
                <p className="text-muted-foreground text-sm">
                  После ручного сохранения поле защищается от перезаписи синком Tilda.
                </p>
              </div>
              {hasAnyOverride ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => void clearSyncOverrides()}
                >
                  Сбросить всю защиту
                </Button>
              ) : null}
            </CardHeader>
            <CardContent>
              <form
                key={project.id}
                className="grid gap-4 md:grid-cols-3"
                onSubmit={saveProject}
              >
                <div className="space-y-1.5 md:col-span-2">
                  <FieldLabelWithOverride
                    htmlFor="name"
                    field="name"
                    overrides={overrides}
                    onClear={(field) => void clearSyncOverrides([field])}
                  />
                  <Input id="name" name="name" defaultValue={project.name} required />
                </div>
                <div className="space-y-1.5">
                  <FieldLabelWithOverride
                    htmlFor="technology"
                    field="technology"
                    overrides={overrides}
                    onClear={(field) => void clearSyncOverrides([field])}
                  />
                  <Select
                    value={technology}
                    onValueChange={(value) =>
                      setTechnology(value as "modular" | "panel_frame")
                    }
                  >
                    <SelectTrigger id="technology" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="modular">{TECHNOLOGY_LABELS.modular}</SelectItem>
                      <SelectItem value="panel_frame">{TECHNOLOGY_LABELS.panel_frame}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 md:col-span-3">
                  <FieldLabelWithOverride
                    htmlFor="description"
                    field="description"
                    overrides={overrides}
                    onClear={(field) => void clearSyncOverrides([field])}
                  />
                  <Textarea
                    id="description"
                    name="description"
                    rows={6}
                    defaultValue={project.description}
                    className="min-h-32 font-mono text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabelWithOverride
                    htmlFor="area"
                    field="area"
                    overrides={overrides}
                    onClear={(field) => void clearSyncOverrides([field])}
                  />
                  <Input
                    id="area"
                    name="area"
                    type="number"
                    min={1}
                    defaultValue={project.area ?? ""}
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabelWithOverride
                    htmlFor="floors"
                    field="floors"
                    overrides={overrides}
                    onClear={(field) => void clearSyncOverrides([field])}
                  />
                  <Input
                    id="floors"
                    name="floors"
                    type="number"
                    min={1}
                    defaultValue={project.floors ?? ""}
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabelWithOverride
                    htmlFor="bedrooms"
                    field="bedrooms"
                    overrides={overrides}
                    onClear={(field) => void clearSyncOverrides([field])}
                  />
                  <Input
                    id="bedrooms"
                    name="bedrooms"
                    type="number"
                    min={0}
                    defaultValue={project.bedrooms ?? ""}
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabelWithOverride
                    htmlFor="bathrooms"
                    field="bathrooms"
                    overrides={overrides}
                    onClear={(field) => void clearSyncOverrides([field])}
                  />
                  <Input
                    id="bathrooms"
                    name="bathrooms"
                    defaultValue={project.bathrooms ?? ""}
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabelWithOverride
                    htmlFor="basePrice"
                    field="basePrice"
                    overrides={overrides}
                    onClear={(field) => void clearSyncOverrides([field])}
                  />
                  <Input
                    id="basePrice"
                    name="basePrice"
                    type="number"
                    min={0}
                    defaultValue={project.basePrice ?? ""}
                  />
                </div>
                <div className="space-y-1.5">
                  <FieldLabelWithOverride
                    htmlFor="active"
                    field="active"
                    overrides={overrides}
                    onClear={(field) => void clearSyncOverrides([field])}
                  />
                  <Select
                    value={active ? "true" : "false"}
                    onValueChange={(value) => setActive(value === "true")}
                  >
                    <SelectTrigger id="active" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Активен</SelectItem>
                      <SelectItem value="false">Скрыт</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-3">
                  <Button type="submit" disabled={saving}>
                    {saving ? <Spinner /> : null}
                    Сохранить
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <IconPhoto className="text-muted-foreground size-5" />
              <h2 className="text-xl font-semibold">
                Изображения
                <span className="text-muted-foreground ml-2 text-base font-normal">
                  ({project.assets.length})
                </span>
              </h2>
            </div>
            <p className="text-muted-foreground text-sm">
              Категории влияют на блоки «Планировка / Экстерьеры / Интерьеры» на сайте партнёра.
              Для планировок многоэтажных домов укажите этаж — на витрине появится подпись
              «Планировка N-го этажа». Скрытые ассеты не показываются на витрине. Тип, этаж,
              главный кадр и скрытие сохраняются при синхронизации с Tilda по URL изображения.
            </p>
            {project.assets.length === 0 ? (
              <EmptyAssets />
            ) : (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {project.assets.map((asset) => {
                  const showFloorSelect =
                    asset.type === "floor_plan" && (project.floors ?? 0) > 1;
                  const floorOptions = Array.from(
                    { length: Math.max(project.floors ?? 0, 0) },
                    (_, i) => i + 1
                  );

                  return (
                  <Card key={asset.id} className={cn(asset.isHidden && "opacity-60")}>
                    <CardContent className="space-y-2 p-3">
                      <div className="bg-muted relative aspect-video overflow-hidden rounded-md border">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={asset.sourceUrl}
                          alt=""
                          className="size-full object-contain"
                        />
                        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                          {asset.isPrimary ? <Badge>Главный</Badge> : null}
                          {asset.isHidden ? <Badge variant="secondary">Скрыт</Badge> : null}
                          {showFloorSelect && asset.floorNumber ? (
                            <Badge variant="outline">{asset.floorNumber} эт.</Badge>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Select
                          value={asset.type}
                          disabled={assetBusyId === asset.id}
                          onValueChange={(value) =>
                            void patchAsset(asset.id, { type: value as AssetType })
                          }
                        >
                          <SelectTrigger size="sm" className="h-8 min-w-0 flex-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ASSET_TYPES.map((t) => (
                              <SelectItem key={t.value} value={t.value}>
                                {t.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button
                          type="button"
                          variant={asset.isPrimary ? "default" : "outline"}
                          size="sm"
                          className="size-8 shrink-0 px-0"
                          disabled={assetBusyId === asset.id || asset.isPrimary}
                          title={asset.isPrimary ? "Главный" : "Сделать главным"}
                          aria-label={asset.isPrimary ? "Главный" : "Сделать главным"}
                          onClick={() => void patchAsset(asset.id, { isPrimary: true })}
                        >
                          {asset.isPrimary ? (
                            <IconStarFilled className="size-4" />
                          ) : (
                            <IconStar className="size-4" />
                          )}
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="size-8 shrink-0 px-0"
                          disabled={assetBusyId === asset.id}
                          title={asset.isHidden ? "Показать" : "Скрыть"}
                          aria-label={asset.isHidden ? "Показать" : "Скрыть"}
                          onClick={() =>
                            void patchAsset(asset.id, { isHidden: !asset.isHidden })
                          }
                        >
                          {asset.isHidden ? (
                            <IconEye className="size-4" />
                          ) : (
                            <IconEyeOff className="size-4" />
                          )}
                        </Button>
                      </div>
                      {showFloorSelect ? (
                        <Select
                          value={
                            asset.floorNumber != null ? String(asset.floorNumber) : "unset"
                          }
                          disabled={assetBusyId === asset.id}
                          onValueChange={(value) =>
                            void patchAsset(asset.id, {
                              floorNumber: value === "unset" ? null : Number(value)
                            })
                          }
                        >
                          <SelectTrigger size="sm" className="h-8 w-full">
                            <SelectValue placeholder="Этаж планировки" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unset">Этаж не указан</SelectItem>
                            {floorOptions.map((floor) => (
                              <SelectItem key={floor} value={String(floor)}>
                                {floor}-й этаж
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : null}
                    </CardContent>
                  </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </DashboardShell>
  );
}

function EmptyAssets() {
  return (
    <Card className={cn("border-dashed")}>
      <CardContent className="text-muted-foreground py-10 text-center text-sm">
        У проекта пока нет изображений. Запустите синхронизацию с Tilda.
      </CardContent>
    </Card>
  );
}
