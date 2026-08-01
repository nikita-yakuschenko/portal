"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Store } from "lucide-react";

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
  area: number | null;
  floors: number | null;
  basePrice: number | null;
  projectUrl: string;
  active: boolean;
};

export default function CompanyCatalogPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

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

  return (
    <DashboardShell
      cabinetLabel={companyCabinetLabel}
      currentPath="/company/catalog"
      navigation={companyNavigation}
    >
      <PageAlert message={error} variant="destructive" />

      <Card>
        <CardHeader>
          <CardTitle>Проекты{loading ? "" : ` (${projects.length})`}</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2, 3].map((row) => (
                <Skeleton key={row} className="h-12 w-full" />
              ))}
            </div>
          ) : projects.length === 0 ? (
            <Empty className="border">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Store />
                </EmptyMedia>
                <EmptyTitle>Каталог пуст</EmptyTitle>
                <EmptyDescription>
                  Запустите синхронизацию с Tilda в разделе «Синхронизации».
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
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
                    <TableHead className="text-right">На сайте</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell className="font-medium">{project.name}</TableCell>
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
                        <Button variant="ghost" size="sm" asChild>
                          <a href={project.projectUrl} target="_blank" rel="noreferrer">
                            Открыть
                            <ExternalLink />
                          </a>
                        </Button>
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
