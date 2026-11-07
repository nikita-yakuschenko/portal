import type { ReactNode } from "react";
import { IconExternalLink, IconFileText } from "@tabler/icons-react";

import { Card, CardContent } from "@/components/ui/card";
import {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentMedia,
  AttachmentTitle,
  AttachmentTrigger
} from "@/components/ui/attachment";

const DOC_SLOTS = [
  { kind: "passport", title: "Паспорт проекта" },
  { kind: "spec", title: "Спецификация комплектации" },
  { kind: "plan", title: "Планировочное решение" },
  { kind: "manual", title: "Инструкция по монтажу" }
] as const;

export type ProjectSupplyDetails = {
  techDocs?: Array<{ kind?: string; title?: string; url?: string; note?: string }>;
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
};

function FactList({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <div key={item.label} className="bg-muted rounded-lg px-3 py-2.5">
          <dt className="text-muted-foreground text-xs tracking-wide uppercase">{item.label}</dt>
          <dd className="mt-1 min-h-5 text-sm font-medium whitespace-pre-wrap">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardContent>
        <h4 className="mb-3 text-sm font-semibold">{title}</h4>
        {children}
      </CardContent>
    </Card>
  );
}

export function ProjectDocsPanel({ details }: { details?: ProjectSupplyDetails | null }) {
  return (
    <div className="flex flex-col gap-2">
      {DOC_SLOTS.map((slot) => {
        const doc = details?.techDocs?.find((item) => item.kind === slot.kind);
        const url = doc?.url?.trim() ?? "";
        const note = doc?.note?.trim() ?? "";
        return (
          <Attachment key={slot.kind} className="w-full max-w-none flex-nowrap" state="done">
            <AttachmentMedia>
              <IconFileText />
            </AttachmentMedia>
            <AttachmentContent>
              <AttachmentTitle>{doc?.title?.trim() || slot.title}</AttachmentTitle>
              <AttachmentDescription>{note}</AttachmentDescription>
            </AttachmentContent>
            {url ? (
              <>
                <AttachmentActions>
                  <AttachmentAction asChild aria-label={`Открыть «${slot.title}»`}>
                    <a href={url} target="_blank" rel="noreferrer">
                      <IconExternalLink />
                    </a>
                  </AttachmentAction>
                </AttachmentActions>
                <AttachmentTrigger asChild>
                  <a href={url} target="_blank" rel="noreferrer" aria-label={`Открыть «${slot.title}»`} />
                </AttachmentTrigger>
              </>
            ) : null}
          </Attachment>
        );
      })}
    </div>
  );
}

export function ProjectLogisticsPanel({ details }: { details?: ProjectSupplyDetails | null }) {
  const cargo = details?.cargo;
  const transport = details?.transport;
  return (
    <div className="space-y-4">
      <Panel title="Груз">
        <FactList
          items={[
            { label: "Состав отгрузки", value: cargo?.modulesNote?.trim() ?? "" },
            { label: "Габариты упаковки", value: cargo?.dimensionsNote?.trim() ?? "" },
            { label: "Масса", value: cargo?.weightNote?.trim() ?? "" },
            { label: "Упаковка", value: cargo?.packingNote?.trim() ?? "" }
          ]}
        />
      </Panel>
      <Panel title="Доставка и монтаж">
        <FactList
          items={[
            { label: "Способ доставки", value: transport?.method?.trim() ?? "" },
            { label: "Сроки", value: transport?.leadTimeNote?.trim() ?? "" },
            { label: "Доставка", value: transport?.deliveryNote?.trim() ?? "" },
            { label: "Разгрузка", value: transport?.unloadingNote?.trim() ?? "" },
            { label: "Монтаж", value: transport?.mountingNote?.trim() ?? "" }
          ]}
        />
      </Panel>
    </div>
  );
}
