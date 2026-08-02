"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { IconMessages, IconPlus } from "@tabler/icons-react";
import { toast } from "sonner";

import { PartnerShell } from "@/components/partner-shell";
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
import { readPartnerModules } from "@/lib/partner-modules";

type Lead = {
  id: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  message?: string | null;
  type: string;
  projectId?: string | null;
  createdAt: string;
};

type LeadsResponse = {
  events: Lead[];
  deliveries: Array<{ leadEventId: string; status: string; externalLeadId?: string | null }>;
};

type Project = {
  id: string;
  name: string;
};

const NO_PROJECT = "__none__";

export default function PartnerLeadsPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [deliveries, setDeliveries] = useState<LeadsResponse["deliveries"]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    projectId: NO_PROJECT,
    message: ""
  });

  const load = useCallback(async () => {
    try {
      setError("");
      const [leadsPayload, projectRows] = await Promise.all([
        apiFetch<LeadsResponse>("/api/partner/leads"),
        apiFetch<Project[]>("/api/partner/catalog/projects")
      ]);
      setLeads(leadsPayload.events);
      setDeliveries(leadsPayload.deliveries);
      setProjects(projectRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить лиды");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!readPartnerModules().leadsEnabled) {
      router.replace("/partner/settings");
      return;
    }
    setAllowed(true);
    void load();
  }, [load, router]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await apiFetch("/api/partner/leads", {
        method: "POST",
        body: JSON.stringify({
          customerName: form.customerName,
          customerPhone: form.customerPhone,
          customerEmail: form.customerEmail || undefined,
          projectId: form.projectId === NO_PROJECT ? undefined : form.projectId,
          message: form.message || undefined
        })
      });
      setForm({
        customerName: "",
        customerPhone: "",
        customerEmail: "",
        projectId: NO_PROJECT,
        message: ""
      });
      toast.success("Лид создан");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось создать лид");
    } finally {
      setSaving(false);
    }
  }

  function deliveryFor(leadId: string) {
    return deliveries.find((item) => item.leadEventId === leadId);
  }

  if (!allowed) {
    return (
      <div className="text-muted-foreground flex min-h-[40vh] items-center justify-center text-sm">
        Переход в настройки…
      </div>
    );
  }

  return (
    <PartnerShell currentPath="/partner/leads">
      <PageAlert message={error} variant="destructive" />

      <div className="grid gap-4 md:gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle>Список лидов</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[0, 1, 2].map((row) => (
                  <Skeleton key={row} className="h-20 w-full" />
                ))}
              </div>
            ) : leads.length === 0 ? (
              <Empty className="border">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <IconMessages />
                  </EmptyMedia>
                  <EmptyTitle>Лидов пока нет</EmptyTitle>
                  <EmptyDescription>
                    Заявки с вашего сайта попадают сюда автоматически. Лид можно добавить и вручную.
                  </EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <ul className="divide-border divide-y">
                {leads.map((lead) => {
                  const delivery = deliveryFor(lead.id);
                  const project = projects.find((item) => item.id === lead.projectId);

                  return (
                    <li key={lead.id} className="py-4 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium">{lead.customerName}</p>
                        <Badge variant={delivery ? "default" : "outline"}>
                          {delivery ? `CRM: ${delivery.status}` : "CRM: не отправлен"}
                        </Badge>
                      </div>
                      <p className="text-muted-foreground mt-1 text-sm">
                        {lead.customerPhone}
                        {lead.customerEmail ? ` · ${lead.customerEmail}` : ""}
                        {project ? ` · ${project.name}` : ""}
                      </p>
                      <p className="text-muted-foreground mt-0.5 text-sm">
                        {lead.type} · {new Date(lead.createdAt).toLocaleString("ru-RU")}
                        {delivery?.externalLeadId ? ` · ID ${delivery.externalLeadId}` : ""}
                      </p>
                      {lead.message ? (
                        <p className="mt-2 text-sm whitespace-pre-line">{lead.message}</p>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Новый лид</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate}>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="customerName">Имя клиента</FieldLabel>
                  <Input
                    id="customerName"
                    required
                    value={form.customerName}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, customerName: e.target.value }))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="customerPhone">Телефон</FieldLabel>
                  <Input
                    id="customerPhone"
                    required
                    value={form.customerPhone}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, customerPhone: e.target.value }))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="customerEmail">Email</FieldLabel>
                  <Input
                    id="customerEmail"
                    type="email"
                    value={form.customerEmail}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, customerEmail: e.target.value }))
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="projectId">Проект</FieldLabel>
                  <Select
                    value={form.projectId}
                    onValueChange={(value) => setForm((prev) => ({ ...prev, projectId: value }))}
                  >
                    <SelectTrigger id="projectId" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_PROJECT}>Без проекта</SelectItem>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="message">Комментарий</FieldLabel>
                  <Textarea
                    id="message"
                    rows={4}
                    value={form.message}
                    onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
                  />
                </Field>
                <Field>
                  <Button type="submit" disabled={saving}>
                    {saving ? <Spinner /> : <IconPlus />}
                    {saving ? "Сохраняем…" : "Создать лид"}
                  </Button>
                </Field>
              </FieldGroup>
            </form>
          </CardContent>
        </Card>
      </div>
    </PartnerShell>
  );
}
