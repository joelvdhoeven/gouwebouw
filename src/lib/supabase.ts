import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Database types
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          naam: string;
          email: string;
          role: 'admin' | 'medewerker' | 'kantoorpersoneel' | 'zzper';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          naam: string;
          email: string;
          role: 'admin' | 'medewerker' | 'kantoorpersoneel' | 'zzper';
        };
        Update: {
          naam?: string;
          email?: string;
          role?: 'admin' | 'medewerker' | 'kantoorpersoneel' | 'zzper';
        };
      };
      projects: {
        Row: {
          id: string;
          naam: string;
          project_nummer: string | null;
          beschrijving: string;
          locatie: string;
          start_datum: string;
          status: 'actief' | 'voltooid' | 'gepauzeerd';
          estimated_hours: number | null;
          progress_percentage: number;
          created_by: string | null;
          oppervlakte_m2: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          naam: string;
          project_nummer?: string;
          beschrijving: string;
          locatie: string;
          start_datum: string;
          status?: 'actief' | 'voltooid' | 'gepauzeerd';
          estimated_hours?: number;
          progress_percentage?: number;
          created_by?: string;
          oppervlakte_m2?: number;
        };
        Update: {
          naam?: string;
          project_nummer?: string;
          beschrijving?: string;
          locatie?: string;
          start_datum?: string;
          status?: 'actief' | 'voltooid' | 'gepauzeerd';
          estimated_hours?: number;
          progress_percentage?: number;
          oppervlakte_m2?: number;
        };
      };
      time_registrations: {
        Row: {
          id: string;
          user_id: string;
          project_id: string | null;
          datum: string;
          werktype: string;
          aantal_uren: number;
          werkomschrijving: string;
          project_naam: string | null;
          locatie: string | null;
          status: 'draft' | 'submitted' | 'approved' | 'rejected';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          project_id?: string;
          datum: string;
          werktype: string;
          aantal_uren: number;
          werkomschrijving: string;
          project_naam?: string;
          locatie?: string;
          status?: 'draft' | 'submitted' | 'approved' | 'rejected';
        };
        Update: {
          project_id?: string;
          datum?: string;
          werktype?: string;
          aantal_uren?: number;
          werkomschrijving?: string;
          project_naam?: string;
          locatie?: string;
          status?: 'draft' | 'submitted' | 'approved' | 'rejected';
        };
      };
      inventory_items: {
        Row: {
          id: string;
          naam: string;
          artikelnummer: string | null;
          barcode: string | null;
          categorie: string;
          locatie: string;
          project_id: string | null;
          voorraad: number;
          minimum_voorraad: number;
          eenheid: string;
          prijs: number | null;
          leverancier: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          naam: string;
          artikelnummer?: string;
          barcode?: string;
          categorie: string;
          locatie: string;
          project_id?: string;
          voorraad: number;
          minimum_voorraad?: number;
          eenheid: string;
          prijs?: number;
          leverancier?: string;
        };
        Update: {
          naam?: string;
          artikelnummer?: string;
          barcode?: string;
          categorie?: string;
          locatie?: string;
          project_id?: string;
          voorraad?: number;
          minimum_voorraad?: number;
          eenheid?: string;
          prijs?: number;
          leverancier?: string;
        };
      };
      special_tools: {
        Row: {
          id: string;
          naam: string;
          beschrijving: string;
          status: 'beschikbaar' | 'in-gebruik' | 'onderhoud';
          locatie: string;
          laatste_onderhoud: string | null;
          volgende_onderhoud: string | null;
          project_id: string | null;
          foto_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          naam: string;
          beschrijving: string;
          status?: 'beschikbaar' | 'in-gebruik' | 'onderhoud';
          locatie: string;
          laatste_onderhoud?: string;
          volgende_onderhoud?: string;
          project_id?: string;
          foto_url?: string;
        };
        Update: {
          naam?: string;
          beschrijving?: string;
          status?: 'beschikbaar' | 'in-gebruik' | 'onderhoud';
          locatie?: string;
          laatste_onderhoud?: string;
          volgende_onderhoud?: string;
          project_id?: string;
          foto_url?: string;
        };
      };
      return_items: {
        Row: {
          id: string;
          naam: string;
          artikelnummer: string | null;
          categorie: string;
          reden: string;
          datum: string;
          status: 'goedgekeurd' | 'in-behandeling' | 'afgekeurd' | 'voltooid';
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          naam: string;
          artikelnummer?: string;
          categorie: string;
          reden: string;
          datum: string;
          status?: 'goedgekeurd' | 'in-behandeling' | 'afgekeurd' | 'voltooid';
          created_by?: string;
        };
        Update: {
          naam?: string;
          artikelnummer?: string;
          categorie?: string;
          reden?: string;
          datum?: string;
          status?: 'goedgekeurd' | 'in-behandeling' | 'afgekeurd' | 'voltooid';
        };
      };
      damage_reports: {
        Row: {
          id: string;
          type_item: 'bus' | 'gereedschap';
          naam: string;
          beschrijving: string;
          datum: string;
          status: 'gemeld' | 'in-behandeling' | 'opgelost';
          foto_url: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          type_item: 'bus' | 'gereedschap';
          naam: string;
          beschrijving: string;
          datum: string;
          status?: 'gemeld' | 'in-behandeling' | 'opgelost';
          foto_url?: string;
          created_by?: string;
        };
        Update: {
          type_item?: 'bus' | 'gereedschap';
          naam?: string;
          beschrijving?: string;
          datum?: string;
          status?: 'gemeld' | 'in-behandeling' | 'opgelost';
          foto_url?: string;
        };
      };
      email_templates: {
        Row: {
          id: string;
          name: string;
          type: 'missing_hours' | 'weekly_overview';
          subject: string;
          body: string;
          enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          name: string;
          type: 'missing_hours' | 'weekly_overview';
          subject: string;
          body: string;
          enabled?: boolean;
        };
        Update: {
          name?: string;
          type?: 'missing_hours' | 'weekly_overview';
          subject?: string;
          body?: string;
          enabled?: boolean;
        };
      };
      email_schedules: {
        Row: {
          id: string;
          template_id: string;
          schedule_type: 'weekly' | 'daily';
          day_of_week: number;
          hour: number;
          target_roles: string[];
          minimum_hours: number;
          enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          template_id: string;
          schedule_type: 'weekly' | 'daily';
          day_of_week: number;
          hour?: number;
          target_roles: string[];
          minimum_hours?: number;
          enabled?: boolean;
        };
        Update: {
          template_id?: string;
          schedule_type?: 'weekly' | 'daily';
          day_of_week?: number;
          hour?: number;
          target_roles?: string[];
          minimum_hours?: number;
          enabled?: boolean;
        };
      };
      email_logs: {
        Row: {
          id: string;
          template_id: string | null;
          user_id: string | null;
          to_email: string;
          subject: string;
          body_html: string | null;
          status: 'sent' | 'failed' | 'pending';
          error: string | null;
          meta: any;
          created_at: string;
        };
        Insert: {
          template_id?: string;
          user_id?: string;
          to_email: string;
          subject: string;
          body_html?: string;
          status?: 'sent' | 'failed' | 'pending';
          error?: string;
          meta?: any;
        };
        Update: {
          status?: 'sent' | 'failed' | 'pending';
          error?: string;
          meta?: any;
        };
      };
    };
  };
}