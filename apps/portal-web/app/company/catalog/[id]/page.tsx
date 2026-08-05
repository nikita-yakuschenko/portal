"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { IconEye, IconEyeOff, IconStar, IconStarFilled } from "@tabler/icons-react";
import { toast } from "sonner";

import { CompanyProjectSummaryCard } from "@/components/company-project-summary-card";
import { DashboardShell } from "@/components/dashboard-shell";
import {
  FactoryPackagesPriceEditor,
  type FactoryOfferLine
} from "@/components/factory-offer-panel";
import { PageAlert } from "@/components/page-alert";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/api";
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
  details?: {
    dimensions?: { label?: string } | null;
  } | null;
  factoryOffer?: {
    importedAt?: string;
    sources?: string[];
    assembly: FactoryOfferLine[];
    extras: FactoryOfferLine[];
  } | null;
  projectUrl: string;
  active: boolean;
  syncOverrides?: SyncOverrides;
  assets: Asset[];
};

const MEDIA_TABS: Array<{ id: string; title: string; types: AssetType[] }> = [
  { id: "exterior", title: "Экстерьер", types: ["exterior"] },
  { id: "interior", title: "Интерьер", types: ["interior"] },
  { id: "floor_plan", title: "Планировка", types: ["floor_plan"] }
];

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-card rounded-xl border p-4 md:p-5", className)}>{children}</div>
  );
}

function SyncDot({ on }: { on?: boolean | undefined }) {
  if (!on) return null;
  return (
    <span
      className="bg-amber-500/90 size-1.5 shrink-0 rounded-full"
      title="Защищено от синка Tilda"
    />
  );
}

export default function CompanyCatalogProjectPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [project, setProject] = useState<Project | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(false);
  const [clearingSync, setClearingSync] = useState(false);
  const [savingDescription, setSavingDescription] = useState(false);
  const [savingOffer, setSavingOffer] = useState(false);
  const [assetBusyId, setAssetBusyId] = useState<string | null>(null);

  async function load() {
    try {
      const data = await apiFetch<Project>(`/api/company/catalog/projects/${id}`);
      setProject(data);
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

  async function saveDescription(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!project) return;
    const fd = new FormData(event.currentTarget);
    setSavingDescription(true);
    try {
      const updated = await apiFetch<Project>(`/api/company/catalog/projects/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ description: String(fd.get("description") || "") })
      });
      setProject(updated);
      toast.success("Описание сохранено");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось сохранить описание");
    } finally {
      setSavingDescription(false);
    }
  }

  async function saveFactoryOffer(next: {
    basePrice: number | null;
    assembly: FactoryOfferLine[];
    extras: FactoryOfferLine[];
  }) {
    setSavingOffer(true);
    try {
      const updated = await apiFetch<Project>(
        `/api/company/catalog/projects/${id}/factory-offer`,
        { method: "PUT", body: JSON.stringify(next) }
      );
      setProject(updated);
      toast.success("Прайс сохранён");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось сохранить прайс");
    } finally {
      setSavingOffer(false);
    }
  }

  async function patchAsset(
    assetId: string,
    body: {
      type?: AssetType;
      floorNumber?: number | null;
      isPrimary?: boolean;
      isHidden?: boolean;
    }
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

  async function clearSyncOverrides() {
    if (!project) return;
    setClearingSync(true);
    try {
      const updated = await apiFetch<Project>(
        `/api/company/catalog/projects/${id}/clear-sync-overrides`,
        { method: "POST", body: JSON.stringify({}) }
      );
      setProject(updated);
      toast.success("Защита синхронизации сброшена");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось сбросить защиту");
    } finally {
      setClearingSync(false);
    }
  }

  const hasSyncOverrides = Object.values(project?.syncOverrides ?? {}).some(Boolean);

  return (
    <DashboardShell
      cabinetKind="company"
      cabinetLabel={companyCabinetLabel}
      currentPath={`/company/catalog/${id}`}
      navigation={companyNavigation}
      title={project?.name ?? "Проект"}
      breadcrumbs={
        <Breadcrumb>
          <BreadcrumbList className="text-sm">
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/company">Главная</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/company/catalog">Каталог</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage className="max-w-[220px] truncate sm:max-w-md">
                {project?.name ?? "Проект"}
              </BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      }
      headerActions={
        <div className="flex items-center gap-2">
          {editMode ? (
            <Button
              type="button"
              variant="outline"
              disabled={!hasSyncOverrides || clearingSync}
              onClick={() => void clearSyncOverrides()}
            >
              {clearingSync ? <Spinner /> : null}
              Сбросить защиту синхронизации
            </Button>
          ) : null}
          <Button
            type="button"
            onClick={() => setEditMode((value) => !value)}
            disabled={!project}
            variant={editMode ? "outline" : "default"}
          >
            {editMode ? "Готово" : "Редактировать"}
          </Button>
        </div>
      }
    >
      <PageAlert message={error} variant="destructive" />

      {loading ? (
        <Skeleton className="h-96 w-full" />
      ) : project ? (
        <div className="grid items-start gap-4 md:gap-6 xl:grid-cols-3">
          {/* 2/3 — сводка + комплектация */}
          <div className="min-w-0 space-y-4 xl:col-span-2">
            <CompanyProjectSummaryCard
              project={project}
              editMode={editMode}
              onUpdated={(next) => {
                setProject((prev) => (prev ? { ...prev, ...next } : prev));
              }}
            />

            <Tabs defaultValue="packages">
              <TabsList className="scrollbar-none h-auto w-full justify-start gap-1 overflow-x-auto">
                <TabsTrigger value="packages">Комплектация</TabsTrigger>
                <TabsTrigger value="docs" disabled title="Скоро">
                  Документация
                </TabsTrigger>
                <TabsTrigger value="logistics" disabled title="Скоро">
                  Логистика
                </TabsTrigger>
              </TabsList>

              <TabsContent value="packages" className="mt-0">
                <Panel>
                  <FactoryPackagesPriceEditor
                    housePrice={project.basePrice}
                    offer={project.factoryOffer}
                    saving={savingOffer}
                    onSave={(next) => void saveFactoryOffer(next)}
                  />
                </Panel>
              </TabsContent>
            </Tabs>
          </div>

          {/* 1/3 справа — весь блок «О проекте» */}
          <aside className="min-w-0 xl:sticky xl:top-6 xl:self-start">
            <Panel className="p-3 md:p-4">
              <p className="mb-3 text-sm font-semibold">О проекте</p>
              <Tabs defaultValue="description">
                <TabsList className="scrollbar-none h-auto w-full flex-wrap justify-start gap-1">
                  <TabsTrigger value="description" className="text-xs">
                    Описание
                  </TabsTrigger>
                  {MEDIA_TABS.map((tab) => (
                    <TabsTrigger key={tab.id} value={tab.id} className="text-xs">
                      {tab.title}
                      <span className="text-muted-foreground ml-1 tabular-nums">
                        ({project.assets.filter((a) => tab.types.includes(a.type)).length})
                      </span>
                    </TabsTrigger>
                  ))}
                  <TabsTrigger value="other" className="text-xs">
                    Прочее
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="description" className="mt-3">
                  <form
                    key={`desc-${project.id}`}
                    className="space-y-3"
                    onSubmit={saveDescription}
                  >
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">Описание</p>
                      <SyncDot on={project.syncOverrides?.description} />
                    </div>
                    <Textarea
                      name="description"
                      rows={10}
                      defaultValue={project.description}
                      className="min-h-48 text-sm"
                    />
                    <Button type="submit" size="sm" disabled={savingDescription}>
                      {savingDescription ? <Spinner /> : null}
                      Сохранить
                    </Button>
                  </form>
                </TabsContent>

                {MEDIA_TABS.map((tab) => {
                  const assets = project.assets.filter((a) => tab.types.includes(a.type));
                  return (
                    <TabsContent key={tab.id} value={tab.id} className="mt-3">
                      {assets.length === 0 ? (
                        <p className="text-muted-foreground py-6 text-center text-sm">
                          Пока пусто
                        </p>
                      ) : (
                        <AssetGrid
                          assets={assets}
                          floors={project.floors}
                          busyId={assetBusyId}
                          onPatch={patchAsset}
                          compact
                        />
                      )}
                    </TabsContent>
                  );
                })}

                <TabsContent value="other" className="mt-3 space-y-4">
                  {/* Не только картинки — любая прочая информация */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Служебное</p>
                    <dl className="text-muted-foreground space-y-1.5 text-xs">
                      <div className="flex justify-between gap-2">
                        <dt>ID</dt>
                        <dd className="text-foreground font-mono text-[11px] break-all">
                          {project.id}
                        </dd>
                      </div>
                      {project.factoryOffer?.importedAt ? (
                        <div className="flex justify-between gap-2">
                          <dt>Прайс обновлён</dt>
                          <dd className="text-foreground">
                            {new Date(project.factoryOffer.importedAt).toLocaleString("ru-RU")}
                          </dd>
                        </div>
                      ) : null}
                      {project.factoryOffer?.sources && project.factoryOffer.sources.length > 0 ? (
                        <div className="flex justify-between gap-2">
                          <dt>Источники прайса</dt>
                          <dd className="text-foreground text-right">
                            {project.factoryOffer.sources.join(", ")}
                          </dd>
                        </div>
                      ) : null}
                      <div className="flex justify-between gap-2">
                        <dt>Ссылка Tilda</dt>
                        <dd className="text-foreground max-w-[60%] truncate text-right">
                          <a
                            href={project.projectUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="hover:text-primary underline-offset-2 hover:underline"
                          >
                            открыть
                          </a>
                        </dd>
                      </div>
                    </dl>
                  </div>

                  {Object.values(project.syncOverrides ?? {}).some(Boolean) ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Защита синхронизации</p>
                      <p className="text-muted-foreground text-xs">
                        Поля с янтарной точкой не перезаписываются Tilda. Сброс — кнопкой слева
                        от «Готово» в режиме редактирования.
                      </p>
                    </div>
                  ) : null}

                  {(() => {
                    const otherAssets = project.assets.filter((a) => a.type === "unknown");
                    if (otherAssets.length === 0) return null;
                    return (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">
                          Неразмеченные фото ({otherAssets.length})
                        </p>
                        <AssetGrid
                          assets={otherAssets}
                          floors={project.floors}
                          busyId={assetBusyId}
                          onPatch={patchAsset}
                          compact
                        />
                      </div>
                    );
                  })()}
                </TabsContent>
              </Tabs>
            </Panel>
          </aside>
        </div>
      ) : null}
    </DashboardShell>
  );
}

function AssetGrid({
  assets,
  floors,
  busyId,
  onPatch,
  compact
}: {
  assets: Asset[];
  floors: number | null;
  busyId: string | null;
  compact?: boolean;
  onPatch: (
    assetId: string,
    body: {
      type?: AssetType;
      floorNumber?: number | null;
      isPrimary?: boolean;
      isHidden?: boolean;
    }
  ) => void;
}) {
  return (
    <div className={cn("grid gap-2", compact ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-3")}>
      {assets.map((asset) => {
        const showFloorSelect = asset.type === "floor_plan" && (floors ?? 0) > 1;
        const floorOptions = Array.from({ length: Math.max(floors ?? 0, 0) }, (_, i) => i + 1);

        return (
          <div
            key={asset.id}
            className={cn(
              "bg-muted/30 overflow-hidden rounded-lg border",
              asset.isHidden && "opacity-55"
            )}
          >
            <div className="bg-muted relative aspect-video overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={asset.sourceUrl} alt="" className="size-full object-cover" />
              <div className="absolute top-2 left-2 flex flex-wrap gap-1">
                {asset.isPrimary ? <Badge>Главный</Badge> : null}
                {asset.isHidden ? <Badge variant="secondary">Скрыт</Badge> : null}
              </div>
            </div>
            <div className="flex items-center gap-1 p-2">
              <Select
                value={asset.type}
                disabled={busyId === asset.id}
                onValueChange={(value) =>
                  void onPatch(asset.id, { type: value as AssetType })
                }
              >
                <SelectTrigger size="sm" className="h-8 min-w-0 flex-1 text-xs">
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
                variant={asset.isPrimary ? "default" : "ghost"}
                size="sm"
                className="size-8 shrink-0 px-0"
                disabled={busyId === asset.id || asset.isPrimary}
                title="Сделать главным"
                aria-label="Сделать главным"
                onClick={() => void onPatch(asset.id, { isPrimary: true })}
              >
                {asset.isPrimary ? (
                  <IconStarFilled className="size-4" />
                ) : (
                  <IconStar className="size-4" />
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="size-8 shrink-0 px-0"
                disabled={busyId === asset.id}
                title={asset.isHidden ? "Показать" : "Скрыть"}
                aria-label={asset.isHidden ? "Показать" : "Скрыть"}
                onClick={() => void onPatch(asset.id, { isHidden: !asset.isHidden })}
              >
                {asset.isHidden ? (
                  <IconEye className="size-4" />
                ) : (
                  <IconEyeOff className="size-4" />
                )}
              </Button>
            </div>
            {showFloorSelect ? (
              <div className="px-2 pb-2">
                <Select
                  value={asset.floorNumber != null ? String(asset.floorNumber) : "unset"}
                  disabled={busyId === asset.id}
                  onValueChange={(value) =>
                    void onPatch(asset.id, {
                      floorNumber: value === "unset" ? null : Number(value)
                    })
                  }
                >
                  <SelectTrigger size="sm" className="h-8 w-full text-xs">
                    <SelectValue placeholder="Этаж" />
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
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
