"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent
} from "@dnd-kit/core";

import { cn } from "@/lib/utils";
import {
  DEAL_STATUSES,
  DEAL_STATUS_DOT,
  DEAL_STATUS_LABEL,
  formatAmount,
  formatDealDate,
  formatUtm,
  type Deal,
  type DealStatus
} from "@/lib/deals";

/** Сумма колонки: воронка в деньгах — первое, на что смотрит дилер */
function columnTotal(deals: Deal[]): number {
  return deals.reduce((sum, deal) => sum + (deal.amount ?? 0), 0);
}

/** Лицо карточки: одинаково в колонке и под курсором при перетаскивании */
function CardFace({ deal, onOpen }: { deal: Deal; onOpen?: (deal: Deal) => void }) {
  const utm = formatUtm(deal.utm);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        {onOpen ? (
          // Название — единственная кликабельная часть: остальное тянется
          <button
            type="button"
            className="min-w-0 truncate text-left text-sm font-medium underline-offset-4 hover:underline"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => onOpen(deal)}
          >
            {deal.title}
          </button>
        ) : (
          <p className="min-w-0 truncate text-sm font-medium">{deal.title}</p>
        )}
        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
          {formatDealDate(deal.createdAt)}
        </span>
      </div>

      {deal.amount !== null ? (
        <p className="text-sm font-medium tabular-nums">{formatAmount(deal.amount)}</p>
      ) : null}

      <p className="text-muted-foreground truncate text-xs">
        {deal.contact ? `${deal.contact.name} · ${deal.contact.phone}` : "Контакт не указан"}
      </p>

      {deal.assigneeName || utm ? (
        <p className="text-muted-foreground truncate text-xs">
          {[deal.assigneeName, utm].filter(Boolean).join(" · ")}
        </p>
      ) : null}
    </div>
  );
}

function DealCard({ deal, onOpen }: { deal: Deal; onOpen: (deal: Deal) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: deal.id,
    data: { status: deal.status }
  });

  // role="button" от dnd-kit сделал бы содержимое карточки presentational,
  // и кнопка с названием пропала бы из дерева доступности
  const { role: _role, ...dragAttributes } = attributes;

  return (
    <li
      ref={setNodeRef}
      className={cn(
        "bg-card cursor-grab touch-none rounded-lg border p-3 active:cursor-grabbing",
        "transition-[border-color,opacity] duration-150",
        "hover:border-ring/50",
        "focus-visible:border-ring focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px]",
        isDragging && "opacity-35"
      )}
      {...listeners}
      {...dragAttributes}
    >
      <CardFace deal={deal} onOpen={onOpen} />
    </li>
  );
}

function Column({
  status,
  deals,
  onOpen
}: {
  status: DealStatus;
  deals: Deal[];
  onOpen: (deal: Deal) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const total = columnTotal(deals);

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "bg-muted/30 flex min-w-0 flex-col rounded-xl border p-3",
        "transition-colors duration-150",
        isOver && "border-ring bg-accent/60"
      )}
    >
      <header className="mb-3">
        <div className="flex items-center gap-2">
          <span
            className={cn("size-1.5 shrink-0 rounded-full", DEAL_STATUS_DOT[status])}
            aria-hidden
          />
          <h2 className="text-sm font-medium">{DEAL_STATUS_LABEL[status]}</h2>
          <span className="text-muted-foreground ml-auto text-xs tabular-nums">{deals.length}</span>
        </div>
        {total > 0 ? (
          <p className="text-muted-foreground mt-1 pl-3.5 text-xs tabular-nums">
            {formatAmount(total)}
          </p>
        ) : null}
      </header>

      {deals.length === 0 ? (
        <p className="text-muted-foreground/70 rounded-lg border border-dashed px-3 py-6 text-center text-xs">
          Перетащите сюда
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {deals.map((deal) => (
            <DealCard key={deal.id} deal={deal} onOpen={onOpen} />
          ))}
        </ul>
      )}
    </section>
  );
}

export function DealsBoard({
  deals,
  onOpen,
  onMove
}: {
  deals: Deal[];
  onOpen: (deal: Deal) => void;
  onMove: (deal: Deal, status: DealStatus) => void;
}) {
  const [dragging, setDragging] = useState<Deal | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  );

  const byStatus = useMemo(() => {
    const map = new Map<DealStatus, Deal[]>(DEAL_STATUSES.map((status) => [status, []]));
    for (const deal of deals) {
      map.get(deal.status)?.push(deal);
    }
    return map;
  }, [deals]);

  function handleDragStart(event: DragStartEvent) {
    setDragging(deals.find((item) => item.id === event.active.id) ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setDragging(null);
    const { active, over } = event;
    if (!over) return;
    const next = over.id as DealStatus;
    const deal = deals.find((item) => item.id === active.id);
    if (!deal || deal.status === next) return;
    onMove(deal, next);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDragging(null)}
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {DEAL_STATUSES.map((status) => (
          <Column key={status} status={status} deals={byStatus.get(status) ?? []} onOpen={onOpen} />
        ))}
      </div>

      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.23, 1, 0.32, 1)" }}>
        {dragging ? (
          <div className="bg-card w-64 rotate-1 rounded-lg border p-3 shadow-lg">
            <CardFace deal={dragging} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
