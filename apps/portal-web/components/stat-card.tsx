export function StatCard(props: { title: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{props.title}</p>
      <p className="mt-3 text-3xl font-semibold text-slate-950">{props.value}</p>
      <p className="mt-2 text-sm text-slate-500">{props.hint}</p>
    </div>
  );
}
