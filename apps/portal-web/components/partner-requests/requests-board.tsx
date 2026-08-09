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
  REQUEST_STATUSES,
  REQUEST_STATUS_DOT,
  REQUEST_STATUS_LABEL,
  formatRequestDate,
  formatUtm,
  telHref,
  type SiteRequest,
  type SiteRequestStatus
} from "@/lib/site-requests";

/** Лицо карточки: одинаково в колонке и под курсором при перетаскивании */
function CardFace({ request }: { request: SiteRequest }) {
  const utm = formatUtm(request.utm);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <p className="min-w-0 truncate text-sm font-medium">{request.customerName}</p>
        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
          {formatRequestDate(request.createdAt)}
        </span>
      </div>
      <p className="text-sm tabular-nums">{request.customerPhone}</p>
      <p className="text-muted-foreground truncate text-xs">
        {request.formName}
        {request.projectName ? ` · ${request.projectName}` : ""}
      </p>
      {utm ? <p className="text-muted-foreground truncate text-xs">{utm}</p> : null}
    </div>
  );
}

function RequestCard({
  request,
  onOpen
}: {
  request: SiteRequest;
  onOpen: (request: SiteRequest) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: request.id,
    data: { status: request.status }
  });

  return (
    <li
      ref={setNodeRef}
      className={cn(
        "bg-card rounded-lg border p-3",
        "transition-[border-color,opacity] duration-150",
        "hover:border-ring/50",
        isDragging && "opacity-35"
      )}
    >
      <div className="flex items-start gap-2">
        {/* Тянем за всю карточку, а открываем кнопкой: клик и drag не спорят */}
        <button
          type="button"
          className="min-w-0 flex-1 cursor-grab text-left outline-none active:cursor-grabbing"
          aria-label={`Перетащить заявку: ${request.customerName}`}
          {...listeners}
          {...attributes}
        >
          <CardFace request={request} />
        </button>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          className="text-primary text-xs underline-offset-4 hover:underline"
          onClick={() => onOpen(request)}
        >
          Открыть
        </button>
        <a
          href={telHref(request.customerPhone)}
          className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
        >
          Позвонить
        </a>
      </div>
    </li>
  );
}

function Column({
  status,
  requests,
  onOpen
}: {
  status: SiteRequestStatus;
  requests: SiteRequest[];
  onOpen: (request: SiteRequest) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "bg-muted/30 flex min-w-0 flex-col rounded-xl border p-3",
        "transition-colors duration-150",
        isOver && "border-ring bg-accent/60"
      )}
    >
      <header className="mb-3 flex items-center gap-2">
        <span
          className={cn("size-1.5 shrink-0 rounded-full", REQUEST_STATUS_DOT[status])}
          aria-hidden
        />
        <h2 className="text-sm font-medium">{REQUEST_STATUS_LABEL[status]}</h2>
        <span className="text-muted-foreground ml-auto text-xs tabular-nums">
          {requests.length}
        </span>
      </header>

      {requests.length === 0 ? (
        <p className="text-muted-foreground/70 rounded-lg border border-dashed px-3 py-6 text-center text-xs">
          Перетащите сюда
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {requests.map((request) => (
            <RequestCard key={request.id} request={request} onOpen={onOpen} />
          ))}
        </ul>
      )}
    </section>
  );
}

export function RequestsBoard({
  requests,
  onOpen,
  onMove
}: {
  requests: SiteRequest[];
  onOpen: (request: SiteRequest) => void;
  onMove: (request: SiteRequest, status: SiteRequestStatus) => void;
}) {
  const [dragging, setDragging] = useState<SiteRequest | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor)
  );

  const byStatus = useMemo(() => {
    const map = new Map<SiteRequestStatus, SiteRequest[]>(
      REQUEST_STATUSES.map((status) => [status, []])
    );
    for (const request of requests) {
      map.get(request.status)?.push(request);
    }
    return map;
  }, [requests]);

  function handleDragStart(event: DragStartEvent) {
    setDragging(requests.find((item) => item.id === event.active.id) ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setDragging(null);
    const { active, over } = event;
    if (!over) return;
    const next = over.id as SiteRequestStatus;
    const request = requests.find((item) => item.id === active.id);
    if (!request || request.status === next) return;
    onMove(request, next);
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
        {REQUEST_STATUSES.map((status) => (
          <Column
            key={status}
            status={status}
            requests={byStatus.get(status) ?? []}
            onOpen={onOpen}
          />
        ))}
      </div>

      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.23, 1, 0.32, 1)" }}>
        {dragging ? (
          <div className="bg-card w-64 rotate-1 rounded-lg border p-3 shadow-lg">
            <CardFace request={dragging} />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
