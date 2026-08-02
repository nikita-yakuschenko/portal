/** Подпись планировки по номеру этажа */
export function floorPlanLabel(floorNumber?: number | null): string {
  if (floorNumber == null || floorNumber < 1) return "Планировка";
  return `Планировка ${floorNumber}-го этажа`;
}
