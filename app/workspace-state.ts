import type { DashboardData, DashboardPeriod } from "./dashboard-types";
import type { Section } from "./HorusViews";
import { asFullMonth, samePeriod } from "./period";

export function firstVisitPeriod(section: Section, source: DashboardPeriod | null, initial: DashboardPeriod): DashboardPeriod | null {
  if (section === "entries" || section === "closing") return source ? asFullMonth(source) : null;
  return source ?? initial;
}

export type WorkspaceSlot = { period: DashboardPeriod | null; data: DashboardData | null; requestId: number; loading: boolean; error: string | null };
export type WorkspaceState = Record<string, WorkspaceSlot>;
export type WorkspaceAction =
  | { type: "open"; key: string; period: DashboardPeriod | null }
  | { type: "start"; key: string; period: DashboardPeriod; requestId: number }
  | { type: "success"; key: string; requestId: number; data: DashboardData }
  | { type: "failure"; key: string; requestId: number; message: string }
  | { type: "invalidate" };
export function workspaceKey(role: "rh" | "pj", section: Section, viewAsId = "") { return role + ":" + (viewAsId || "self") + ":" + section; }
function emptySlot(period: DashboardPeriod | null): WorkspaceSlot { return { period, data: null, requestId: -1, loading: false, error: null }; }
export function initialWorkspace(key: string, data: DashboardData): WorkspaceState { return { [key]: { ...emptySlot(data.period), data } }; }
export function workspaceReducer(state: WorkspaceState, action: WorkspaceAction): WorkspaceState {
  if (action.type === "invalidate") return Object.fromEntries(Object.entries(state).map(([key, slot]) => [key, emptySlot(slot.period)]));
  if (action.type === "open") return state[action.key] ? state : { ...state, [action.key]: emptySlot(action.period) };
  if (action.type === "start") return { ...state, [action.key]: { ...emptySlot(action.period), requestId: action.requestId, loading: true } };
  const slot = state[action.key];
  if (!slot || slot.requestId !== action.requestId) return state;
  if (action.type === "failure") return { ...state, [action.key]: { ...slot, data: null, loading: false, error: action.message } };
  if (!slot.period || !samePeriod(slot.period, action.data.period)) {
    return { ...state, [action.key]: { ...slot, data: null, loading: false, error: "A resposta não corresponde ao período escolhido. Tente novamente." } };
  }
  return { ...state, [action.key]: { ...slot, data: action.data, loading: false, error: null } };
}
