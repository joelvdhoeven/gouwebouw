export interface MaterialLine {
  type: 'product' | 'description';
  product_id?: string;
  product_name?: string;
  description?: string;
  quantity: number;
  unit?: string;
}

export interface WorkLine {
  werktype: string;
  werkomschrijving: string;
  aantal_uren: number;
  materials?: MaterialLine[];
}

export interface UrenRegistratie {
  id: string;
  user_id?: string;
  project_id?: string;
  datum: string;
  werktype: string;
  aantal_uren: number;
  werkomschrijving: string;
  work_lines?: WorkLine[];
  project_naam?: string;
  locatie?: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
}

export interface MagazijnItem {
  id: string;
  naam: string;
  artikelnummer?: string;
  barcode?: string;
  categorie: string;
  locatie: string;
  projectId?: string;
  voorraad: number;
  minimumVoorraad: number;
  eenheid: string;
  prijs?: number;
  leverancier?: string;
  createdAt: string;
  updatedAt: string;
}

export type Language = 'nl' | 'en' | 'pl';

export interface Translations {
  [key: string]: string | Translations;
}

export interface RetourItem {
  id: string;
  naam: string;
  artikelnummer?: string;
  categorie: string;
  reden: string;
  datum: string;
  status: 'goedgekeurd' | 'in-behandeling' | 'afgekeurd' | 'voltooid';
  createdAt: string;
}

export interface Schademelding {
  id: string;
  typeItem: 'bus' | 'gereedschap';
  naam: string;
  beschrijving: string;
  datum: string;
  status: 'gemeld' | 'in-behandeling' | 'opgelost';
  fotoUrl?: string;
  createdAt: string;
}

export interface Project {
  id: string;
  naam: string;
  beschrijving: string;
  locatie: string;
  startDatum: string;
  status: 'actief' | 'voltooid' | 'gepauzeerd';
  estimatedHours?: number;
  progressPercentage?: number;
  project_nummer?: string;
  oppervlakteM2?: number;
  createdAt: string;
  updatedAt: string;
}

export interface SpeciaalGereedschap {
  id: string;
  naam: string;
  beschrijving: string;
  status: 'beschikbaar' | 'in-gebruik' | 'onderhoud';
  locatie: string;
  laatsteOnderhoud?: string;
  volgendeOnderhoud?: string;
  projectId?: string;
  fotoUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  id: string;
  recipient_id: string;
  sender_id?: string; // Null for system notifications
  type: 'time_registration_submitted' | 'missing_hours_reminder' | 'system_alert' | 'user_inactive' | 'user_active';
  title: string;
  message: string;
  related_entity_type?: 'time_registration' | 'project' | 'user';
  related_entity_id?: string;
  status: 'unread' | 'read' | 'archived';
  created_at: string;
  updated_at: string;
}

export interface ProjectMaterial {
  id: string;
  projectId: string;
  magazijnItemId: string;
  naam: string;
  hoeveelheid: number;
  eenheid: string;
  genomenOp: string;
  fotoUrl?: string;
  opmerkingen?: string;
}

export type UserRole = 'admin' | 'medewerker' | 'kantoorpersoneel' | 'zzper' | 'superuser';

export interface User {
  id: string;
  naam: string;
  email: string;
  role: UserRole;
}

export interface TicketAttachment {
  name: string;
  url: string;
  type: string;
  size: number;
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed' | 'archived';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  created_by: string;
  assigned_to?: string;
  attachments?: TicketAttachment[];
  created_at: string;
  updated_at: string;
  resolved_at?: string;
}

export interface TicketComment {
  id: string;
  ticket_id: string;
  user_id: string;
  comment: string;
  created_at: string;
  updated_at: string;
  user_name?: string;
  user_role?: string;
}

export interface AuthContextType {
  user: User | null;
  profile: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasPermission: (permission: string) => boolean;
}