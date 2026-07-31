"use client";

import { useEffect, useState } from "react";

import { DashboardShell } from "../../../components/dashboard-shell";
import { apiFetch } from "@/lib/api";
import { companyCabinetLabel, companyNavigation } from "@/lib/company-nav";

type Partner = {
  id: string;
  companyName: string;
  email: string;
  phone: string;
  region: string;
  status: string;
  createdAt: string;
};

export default function CompanyPartnersPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        setPartners(await apiFetch<Partner[]>("/api/company/partners"));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить партнёров");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <DashboardShell
      cabinetLabel={companyCabinetLabel}
      currentPath="/company/partners"
      navigation={companyNavigation}
    >
      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-950">Список партнёров</h2>
        <div className="mt-4 space-y-3">
          {loading ? (
            <p className="text-sm text-slate-500">Загрузка...</p>
          ) : partners.length === 0 ? (
            <p className="text-sm text-slate-500">Партнёров пока нет.</p>
          ) : (
            partners.map((partner) => (
              <div key={partner.id} className="rounded-xl border border-slate-200 px-4 py-3">
                <p className="font-medium text-slate-950">{partner.companyName}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {partner.region} · {partner.email} · {partner.phone || "—"} · {partner.status}
                </p>
              </div>
            ))
          )}
        </div>
      </section>
    </DashboardShell>
  );
}
