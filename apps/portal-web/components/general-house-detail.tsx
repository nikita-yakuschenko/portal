"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { PartnerShell } from "@/components/partner-shell";
import { PageAlert } from "@/components/page-alert";
import { ProjectAboutPanel } from "@/components/project-about-panel";
import { ProjectDocsPanel, ProjectLogisticsPanel } from "@/components/project-supply-panels";
import { ProjectSpecsStrip } from "@/components/project-specs-strip";
import { ProjectSummaryCard } from "@/components/project-summary-card";
import { Badge } from "@/components/ui/badge";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from "@/components/ui/breadcrumb";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/api";
import {
  technologyBadgeCode,
  technologyBadgeVariant
} from "@/lib/catalog-display";
import { formatPrice } from "@/lib/general-section";
import { factoryOptionKey } from "@/lib/partner-pricing";
type ProjectDetails = {
  series?: string;
  dimensions?: { label?: string };
  cargo?: {
    modulesNote?: string;
    dimensionsNote?: string;
    weightNote?: string;
    packingNote?: string;
  };
  transport?: {
    method?: string;
    leadTimeNote?: string;
    deliveryNote?: string;
    unloadingNote?: string;
    mountingNote?: string;
  };
  techDocs: Array<{
    id: string;
    title: string;
    kind: string;
    status: "available" | "on_request";
    url?: string;
    note?: string;
  }>;
};

type OfferLine = { id: string; name: string; price: number };

type Project = {
  id: string;
  name: string;
  description: string;
  technology: "modular" | "panel_frame" | "frame";
  details: ProjectDetails;
  area: number | null;
  floors: number | null;
  bedrooms: number | null;
  bathrooms: string | null;
  basePrice: number | null;
  factoryOffer?: {
    importedAt?: string;
    sources?: string[];
    assembly: OfferLine[];
    extras: OfferLine[];
  } | null;
  assets: Array<{
    id: string;
    sourceUrl: string;
    localPath?: string | null;
    type: string;
    floorNumber?: number | null;
    sortOrder: number;
    isPrimary: boolean;
  }>;
  rooms: Array<{
    id: string;
    projectId: string;
    floorNumber: number;
    name: string;
    area: number;
    sortOrder: number;
    polygon: Array<{ x: number; y: number }>;
  }>;
};

const TECH_TITLE: Record<Project["technology"], string> = {
  panel_frame: "Панельно-каркасные дома",
  modular: "Модульные дома",
  frame: "Каркасные дома"
};

/** Группы опций — те же, что в партнёрском прайсе, но без тумблеров */
const EXTRA_GROUPS: Array<{ id: string; title: string; matchers: string[] }> = [
  { id: "exterior", title: "Экстерьер", matchers: ["настил кровли", "терраса"] },
  {
    id: "interior",
    title: "Интерьер",
    matchers: [
      "настил пола",
      "пвх плинтус",
      "отделка потолка",
      "отделка стен",
      "внутренняя покраска",
      "укладка плитки",
      "межкомнатн"
    ]
  },
  {
    id: "comms",
    title: "Коммуникации",
    matchers: ["отопление", "вентиляция", "водопровод", "канализация", "фаянс"]
  },
  { id: "electric", title: "Электрика", matchers: ["электрика"] }
];

function groupExtras(extras: OfferLine[]) {
  const buckets = new Map<string, OfferLine[]>();
  for (const group of EXTRA_GROUPS) buckets.set(group.id, []);
  buckets.set("other", []);

  for (const item of extras) {
    const key = factoryOptionKey(item.name);
    const group =
      EXTRA_GROUPS.find((row) => row.matchers.some((m) => key.includes(m))) ?? null;
    buckets.get(group?.id ?? "other")!.push(item);
  }

  return [
    ...EXTRA_GROUPS.map((group) => ({
      id: group.id,
      title: group.title,
      items: buckets.get(group.id) ?? []
    })),
    { id: "other", title: "Другое", items: buckets.get("other") ?? [] }
  ].filter((group) => group.items.length > 0);
}

function PriceLines({ items }: { items: OfferLine[] }) {
  return (
    <ul className="divide-border divide-y">
      {items.map((item) => (
        <li key={item.id} className="flex items-center justify-between gap-4 py-2 text-sm">
          <span className="min-w-0">{item.name}</span>
          <span className="shrink-0 font-semibold tabular-nums">{formatPrice(item.price)}</span>
        </li>
      ))}
    </ul>
  );
}

/** Прайс завода только для просмотра — без конфигурирования */
function FactoryPriceCatalog({
  housePrice,
  offer
}: {
  housePrice: number | null;
  offer: Project["factoryOffer"];
}) {
  const assembly = offer?.assembly ?? [];
  const groups = groupExtras(offer?.extras ?? []);
  const sections = [
    ...(assembly.length > 0 ? [{ id: "assembly", title: "Сборка", items: assembly }] : []),
    ...groups
  ];
  const hasAnything = housePrice != null || sections.length > 0;

  if (!hasAnything) {
    return <p className="text-muted-foreground text-sm">Прайс комплектации пока не загружен.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium">Домокомплект</p>
        <p className="text-base font-semibold tabular-nums">
          {housePrice != null ? formatPrice(housePrice) : "Цена по запросу"}
        </p>
      </div>

      {sections.length > 0 ? (
        <Tabs defaultValue={sections[0]!.id} className="gap-2">
          <TabsList className="scrollbar-none h-auto w-full justify-start gap-1 overflow-x-auto">
            {sections.map((section) => (
              <TabsTrigger key={section.id} value={section.id}>
                {section.title}
              </TabsTrigger>
            ))}
          </TabsList>
          {sections.map((section) => (
            <TabsContent key={section.id} value={section.id} className="mt-0 px-1">
              <PriceLines items={section.items} />
            </TabsContent>
          ))}
        </Tabs>
      ) : null}
    </div>
  );
}

function Panel({
  children,
  className
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function GeneralHouseDetail({ projectKey }: { projectKey: string }) {
  const projectId = projectKey;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        setProject(await apiFetch<Project>(`/api/partner/general/houses/${projectId}`));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить проект");
      } finally {
        setLoading(false);
      }
    })();
  }, [projectId]);

  const details = project?.details;

  const assets = useMemo(
    () =>
      (project?.assets ?? []).map((asset) => ({
        ...asset,
        sourceUrl: asset.localPath || asset.sourceUrl
      })),
    [project]
  );

  const listHref = project
    ? `/portal/general/houses?technology=${project.technology}`
    : "/portal/general/houses";

  return (
    <PartnerShell
      currentPath="/portal/general"
      title={project?.name ?? "Проект"}
      breadcrumbs={
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/portal/general">Общий раздел</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href={listHref}>
                  {project ? TECH_TITLE[project.technology] : "Дома"}
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            {project ? (
              <>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{project.name}</BreadcrumbPage>
                </BreadcrumbItem>
              </>
            ) : null}
          </BreadcrumbList>
        </Breadcrumb>
      }
    >
      <PageAlert message={error} variant="destructive" />

      {loading ? <Skeleton className="h-96 w-full" /> : null}

      {!loading && project && details ? (
        <div className="space-y-4 md:space-y-6">
          <ProjectSummaryCard
            title={<h2 className="text-xl font-semibold tracking-tight">{project.name}</h2>}
            badge={
              <Badge variant={technologyBadgeVariant(project.technology)}>
                {technologyBadgeCode(project.technology)}
              </Badge>
            }
            specs={
              <ProjectSpecsStrip
                className="mt-auto"
                area={project.area}
                dimensionsLabel={details.dimensions?.label}
                blankDimensions
                floors={project.floors}
                bedrooms={project.bedrooms}
                bathrooms={project.bathrooms}
              />
            }
            prices={
              <>
                <p className="text-muted-foreground text-xs">Цена для дилера</p>
                <p className="text-lg font-semibold tabular-nums">
                  {project.basePrice != null
                    ? formatPrice(project.basePrice)
                    : "Цена по запросу"}
                </p>
              </>
            }
          />

          <Tabs defaultValue="about" className="gap-[15px] md:gap-[23px]">
            <TabsList className="scrollbar-none h-auto w-full justify-start gap-1 overflow-x-auto">
              <TabsTrigger value="about">О проекте</TabsTrigger>
              <TabsTrigger value="packages">Комплектация</TabsTrigger>
              <TabsTrigger value="docs">Документация</TabsTrigger>
              <TabsTrigger value="logistics">Логистика</TabsTrigger>
            </TabsList>

            <TabsContent value="about" className="mt-0">
              <Panel className="pb-[23px]">
                <ProjectAboutPanel
                  projectName={project.name}
                  description={project.description}
                  seriesLabel={details.series ?? null}
                  assets={assets}
                  floors={project.floors}
                  rooms={project.rooms}
                  showDescription={false}
                />
              </Panel>
            </TabsContent>

            <TabsContent value="packages" className="mt-0">
              <Panel>
                <FactoryPriceCatalog
                  housePrice={project.basePrice}
                  offer={project.factoryOffer}
                />
              </Panel>
            </TabsContent>

            <TabsContent value="docs" className="mt-0">
              <ProjectDocsPanel details={details} />
            </TabsContent>
            <TabsContent value="logistics" className="mt-0">
              <ProjectLogisticsPanel details={details} />
            </TabsContent>
          </Tabs>
        </div>
      ) : null}
    </PartnerShell>
  );
}
