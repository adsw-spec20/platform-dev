/** Order status state machine (mirror of the DB trigger - DB is authoritative). */
export const ORDER_STATUSES = [
  "new",
  "preparing",
  "ready",
  "out_for_delivery",
  "completed",
  "canceled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  new: ["preparing", "canceled"],
  preparing: ["ready", "canceled"],
  ready: ["out_for_delivery", "completed", "canceled"],
  out_for_delivery: ["completed", "canceled"],
  completed: [],
  canceled: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  new: "חדשה",
  preparing: "בהכנה",
  ready: "מוכנה",
  out_for_delivery: "בדרך אליך",
  completed: "הושלמה",
  canceled: "בוטלה",
};
