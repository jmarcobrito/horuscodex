export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: "DEV" | "RH" | "PJ" | "ADMIN";
  status: "ACTIVE" | "INACTIVE";
  hasAccess: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminAudit = {
  id: string;
  actorName: string;
  action: string;
  targetName: string;
  reason: string;
  createdAt: string;
};

export type AdminData = {
  users: AdminUser[];
  audits: AdminAudit[];
};

export type AdminSector = {
  id: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
  memberCount: number;
  createdAt?: string;
  updatedAt?: string;
};

export type SectorUpdate = {
  name: string;
  status: AdminSector["status"];
  reason: string;
};
