"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { IconBuildingStore, IconExternalLink } from "@tabler/icons-react";

import { CatalogProjectCard } from "@/components/catalog-project-card";
import {
  CatalogViewToggle,
  type CatalogViewMode
} from "@/components/catalog-view-toggle";
import { DashboardShell } from "@/components/dashboard-shell";
import { PageAlert } from "@/components/page-alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { apiFetch } from "@/lib/api";
import { companyCabinetLabel, companyNavigation } from "@/lib/company-nav";

type Project = {
  id: string;
  name: string;
  description: string;
  technology: "modular" | "panel_frame";
  area: number | null;
  floors: number | null;
  bedrooms: number | null;
  basePrice: number | null;
  projectUrl: string;
  active: boolean;
  assets?: Array<{ sourceUrl: string; isPrimary: boolean; sortOrder?: number }>;
};

const VIEW_KEY = "avgst.company.catalog.view";

function loadView(): CatalogViewMode {
  try {
    const raw = localStorage.getItem(VIEW_KEY);
    return raw === "cards" || raw === "table" ? raw : "table";
  } catch {
    return "table";
  }
}

export default function CompanyCatalogPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<CatalogViewMode>("table");

  useEffect(() => {
    setView(loadView());
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        setProjects(await apiFetch<Project[]>("/api/company/catalog/projects"));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить каталог");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function changeView(next: CatalogViewMode) {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      /* ignore */
    }
  }

  return (
    <DashboardShell
      cabinetLabel={companyCabinetLabel}
      currentPath="/company/catalog"
      navigation={companyNavigation}
    >
      <PageAlert message={error} variant="destructive" />

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
          <CardTitle>Проекты{loading ? "" : ` (${projects.length})`}</CardTitle>
          {!loading && projects.length > 0 ? (
            <CatalogViewToggle value={view} onChange={changeView} />
          ) : null}
        </CardHeader>
        <CardContent>
          {loading ? (
            view === "cards" ? (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {[0, 1, 2, 3, 4, 5].map((row) => (
                  <Skeleton key={row} className="aspect-video w-full rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {[0, 1, 2, 3].map((row) => (
                  <Skeleton key={row} className="h-12 w-full" />
                ))}
              </div>
            )
          ) : projects.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <IconBuildingStore />
                </EmptyMedia>
                <EmptyTitle>Каталог пуст</EmptyTitle>
                <EmptyDescription>
                  Запустите синхронизацию с Tilda в разделе «Синхронизации».
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : view === "cards" ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {projects.map((project) => (
                <CatalogProjectCard
                  key={project.id}
                  href={`/company/catalog/${project.id}`}
                  name={project.name}
                  description={project.description}
                  technology={project.technology}
                  area={project.area}
                  floors={project.floors}
                  bedrooms={project.bedrooms}
                  basePrice={project.basePrice}
                  retailPrice={null}
                  retailOnRequest={false}
                  assets={project.assets ?? []}
                  hideRetail
                />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Проект</TableHead>
                    <TableHead>Площадь</TableHead>
                    <TableHead>Этажи</TableHead>
                    <TableHead>Заводская цена</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell className="font-medium">
                        <Link
                          href={`/company/catalog/${project.id}`}
                          className="hover:text-primary underline-offset-4 hover:underline"
                        >
                          {project.name}
                        </Link>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {project.area ? `${project.area} м²` : "—"}
                      </TableCell>
                      <TableCell className="tabular-nums">{project.floors ?? "—"}</TableCell>
                      <TableCell className="tabular-nums whitespace-nowrap">
                        {project.basePrice
                          ? `${project.basePrice.toLocaleString("ru-RU")} ₽`
                          : "по запросу"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={project.active ? "default" : "secondary"}>
                          {project.active ? "Активен" : "Скрыт"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/company/catalog/${project.id}`}>Открыть</Link>
                          </Button>
                          <Button variant="ghost" size="sm" asChild>
                            <a href={project.projectUrl} target="_blank" rel="noreferrer">
                              Сайт
                              <IconExternalLink />
                            </a>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardShell>
  );
}
