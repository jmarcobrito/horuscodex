import { House, Clock, ClipboardCheck, CalendarCheck, Users, FileText, Settings, Wallet, ChevronDown, ChevronLeft, ChevronRight, Check } from "lucide-react";

const icons = {
  home: House, entries: Clock, requests: ClipboardCheck, closing: CalendarCheck,
  people: Users, reports: FileText, admin: Settings, balance: Wallet,
  down: ChevronDown, previous: ChevronLeft, next: ChevronRight, check: Check,
};

export type UiIconName = keyof typeof icons;

export function UiIcon({ name, size = 18 }: { name: UiIconName; size?: number }) {
  const Icon = icons[name];
  return <Icon size={size} strokeWidth={1.75} aria-hidden="true" focusable="false" />;
}
