"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { CompanyProjectSummaryCard } from "@/components/company-project-summary-card";
import { DashboardShell } from "@/components/dashboard-shell";
import {
  FactoryPackagesPriceEditor,
  type FactoryOfferLine
} from "@/components/factory-offer-panel";
import { PageAlert } from "@/components/page-alert";
import {
  ProjectAboutPanel,
  type AboutAssetPatch
} from "@/components/project-about-panel";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/api";
import { companyCabinetLabel, companyNavigation } from "@/lib/company-nav";

type Asset = {
  id: string;
  sourceUrl: string;
  type: string;
  floorNumber: number | null;
  sortOrder: number;
  isPrimary: boolean;
  isHidden: boolean;
};

type Room = {
  id: string;
  projectId: string;
  floorNumber: number;
  name: string;
  area: number;
  sortOrder: number;
  polygon: Array<{ x: number; y: number }>;
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
  rooms: Room[];
};

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <Card className="pb-[23px]">
      <CardContent>{children}</CardContent>
    </Card>
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
  const [roomBusyId, setRoomBusyId] = useState<string | null>(null);

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

  async function saveDescription(description: string) {
    setSavingDescription(true);
    try {
      const updated = await apiFetch<Project>(`/api/company/catalog/projects/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ description })
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

  async function patchAsset(assetId: string, body: AboutAssetPatch) {
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

  async function createRoom(body: { floorNumber: number; name: string; area: number }) {
    if (!project) return;
    try {
      const updated = await apiFetch<Project>(`/api/company/catalog/projects/${project.id}/rooms`, {
        method: "POST",
        body: JSON.stringify(body)
      });
      setProject(updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось добавить помещение");
    }
  }

  async function patchRoom(
    roomId: string,
    body: {
      name?: string;
      area?: number;
      polygon?: Array<{ x: number; y: number }>;
      sortOrder?: number;
    }
  ) {
    // Только sortOrder — без busy-спиннера, иначе при DnD мигает вся строка
    const sortOnly =
      body.sortOrder !== undefined &&
      body.name === undefined &&
      body.area === undefined &&
      body.polygon === undefined;
    if (!sortOnly) setRoomBusyId(roomId);
    try {
      const updated = await apiFetch<Project>(`/api/company/catalog/rooms/${roomId}`, {
        method: "PATCH",
        body: JSON.stringify(body)
      });
      setProject(updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось обновить помещение");
    } finally {
      if (!sortOnly) setRoomBusyId(null);
    }
  }

  async function deleteRoom(roomId: string) {
    setRoomBusyId(roomId);
    try {
      const updated = await apiFetch<Project>(`/api/company/catalog/rooms/${roomId}`, {
        method: "DELETE"
      });
      setProject(updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось удалить помещение");
    } finally {
      setRoomBusyId(null);
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
      {loading ? <Skeleton className="h-96 w-full" /> : null}

      {!loading && project ? (
        <div className="min-w-0 space-y-2">
          <CompanyProjectSummaryCard
            project={project}
            editMode={editMode}
            onUpdated={(next) => {
              setProject((prev) => (prev ? { ...prev, ...next } : prev));
            }}
          />

          <Tabs defaultValue="about" className="gap-[15px] md:gap-[23px]">
            <TabsList className="scrollbar-none h-auto w-full justify-start gap-1 overflow-x-auto">
              <TabsTrigger value="about">О проекте</TabsTrigger>
              <TabsTrigger value="packages">Комплектация</TabsTrigger>
              <TabsTrigger value="options">Опции</TabsTrigger>
              <TabsTrigger value="docs" disabled title="Скоро">
                Документация
              </TabsTrigger>
              <TabsTrigger value="logistics" disabled title="Скоро">
                Логистика
              </TabsTrigger>
            </TabsList>

            <TabsContent value="about" className="mt-0">
              <Panel>
                <ProjectAboutPanel
                  projectName={project.name}
                  description={project.description}
                  assets={project.assets}
                  floors={project.floors}
                  rooms={project.rooms}
                  editable={editMode}
                  savingDescription={savingDescription}
                  onSaveDescription={(next) => void saveDescription(next)}
                  descriptionProtected={Boolean(project.syncOverrides?.description)}
                  assetBusyId={assetBusyId}
                  roomBusyId={roomBusyId}
                  {...(editMode
                    ? {
                        onPatchAsset: (assetId: string, patch: AboutAssetPatch) =>
                          void patchAsset(assetId, patch),
                        onCreateRoom: (body: { floorNumber: number; name: string; area: number }) =>
                          void createRoom(body),
                        onPatchRoom: (
                          roomId: string,
                          patch: {
                            name?: string;
                            area?: number;
                            polygon?: Array<{ x: number; y: number }>;
                            sortOrder?: number;
                          }
                        ) => void patchRoom(roomId, patch),
                        onDeleteRoom: (roomId: string) => void deleteRoom(roomId)
                      }
                    : {})}
                  extra={
                    <section className="space-y-3">
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
                              {new Date(project.factoryOffer.importedAt).toLocaleString(
                                "ru-RU"
                              )}
                            </dd>
                          </div>
                        ) : null}
                        {project.factoryOffer?.sources &&
                        project.factoryOffer.sources.length > 0 ? (
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
                      {hasSyncOverrides ? (
                        <p className="text-muted-foreground text-xs">
                          Поля с янтарной точкой не перезаписываются Tilda. Сброс — кнопкой
                          слева от «Готово» в режиме редактирования.
                        </p>
                      ) : null}
                    </section>
                  }
                />
              </Panel>
            </TabsContent>

            <TabsContent value="packages" className="mt-0">
              <Panel>
                <FactoryPackagesPriceEditor
                  section="assembly"
                  housePrice={project.basePrice}
                  offer={project.factoryOffer}
                  saving={savingOffer}
                  editable={editMode}
                  onSave={(next) => void saveFactoryOffer(next)}
                />
              </Panel>
            </TabsContent>

            <TabsContent value="options" className="mt-0">
              <Panel>
                <FactoryPackagesPriceEditor
                  section="extras"
                  housePrice={project.basePrice}
                  offer={project.factoryOffer}
                  saving={savingOffer}
                  editable={editMode}
                  onSave={(next) => void saveFactoryOffer(next)}
                />
              </Panel>
            </TabsContent>
          </Tabs>
        </div>
      ) : null}
    </DashboardShell>
  );
}
