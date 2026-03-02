export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          transmission_preference: string | null;
          car_body_preference: string | null;
          car_style_preference: string | null;
          fuel_consumption_priority: string | null;
          electric_future_preference: string | null;
          onboarding_completed_at: string | null;
          email_verified_at: string | null;
          car_selection_completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          transmission_preference?: string | null;
          car_body_preference?: string | null;
          car_style_preference?: string | null;
          fuel_consumption_priority?: string | null;
          electric_future_preference?: string | null;
          onboarding_completed_at?: string | null;
          email_verified_at?: string | null;
          car_selection_completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          full_name?: string | null;
          transmission_preference?: string | null;
          car_body_preference?: string | null;
          car_style_preference?: string | null;
          fuel_consumption_priority?: string | null;
          electric_future_preference?: string | null;
          onboarding_completed_at?: string | null;
          email_verified_at?: string | null;
          car_selection_completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      verification_codes: {
        Row: {
          id: string;
          user_id: string;
          code: string;
          purpose: string;
          expires_at: string;
          used_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          code: string;
          purpose?: string;
          expires_at: string;
          used_at?: string | null;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          code?: string;
          purpose?: string;
          expires_at?: string;
          used_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "verification_codes_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
            isOneToOne: false;
          }
        ];
      };
      cars: {
        Row: {
          id: string;
          owner_id: string;
          nickname: string | null;
          make: string;
          model: string;
          year: number | null;
          license_plate: string | null;
          vin: string | null;
          mileage: number | null;
          color: string | null;
          fuel_type: string | null;
          transmission: string | null;
          body_type: string | null;
          engine_size: string | null;
          horsepower: number | null;
          image_url: string | null;
          usage_type: string | null;
          purchase_date: string | null;
          purchase_price: number | null;
          is_primary: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          nickname?: string | null;
          make: string;
          model: string;
          year?: number | null;
          license_plate?: string | null;
          vin?: string | null;
          mileage?: number | null;
          color?: string | null;
          fuel_type?: string | null;
          transmission?: string | null;
          body_type?: string | null;
          engine_size?: string | null;
          horsepower?: number | null;
          image_url?: string | null;
          usage_type?: string | null;
          purchase_date?: string | null;
          purchase_price?: number | null;
          is_primary?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          owner_id?: string;
          nickname?: string | null;
          make?: string;
          model?: string;
          year?: number | null;
          license_plate?: string | null;
          vin?: string | null;
          mileage?: number | null;
          color?: string | null;
          fuel_type?: string | null;
          transmission?: string | null;
          body_type?: string | null;
          engine_size?: string | null;
          horsepower?: number | null;
          image_url?: string | null;
          usage_type?: string | null;
          purchase_date?: string | null;
          purchase_price?: number | null;
          is_primary?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cars_owner_id_fkey";
            columns: ["owner_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
            isOneToOne: false;
          }
        ];
      };
      service_records: {
        Row: {
          id: string;
          owner_id: string;
          car_id: string;
          service_date: string;
          service_type: string;
          provider: string | null;
          cost: number;
          mileage: number | null;
          notes: string | null;
          next_service_due_at: string | null;
          deleted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          car_id: string;
          service_date: string;
          service_type: string;
          provider?: string | null;
          cost?: number;
          mileage?: number | null;
          notes?: string | null;
          next_service_due_at?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          owner_id?: string;
          car_id?: string;
          service_date?: string;
          service_type?: string;
          provider?: string | null;
          cost?: number;
          mileage?: number | null;
          notes?: string | null;
          next_service_due_at?: string | null;
          deleted_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "service_records_owner_id_fkey";
            columns: ["owner_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
            isOneToOne: false;
          },
          {
            foreignKeyName: "service_records_car_id_fkey";
            columns: ["car_id"];
            referencedRelation: "cars";
            referencedColumns: ["id"];
            isOneToOne: false;
          }
        ];
      };
      documents: {
        Row: {
          id: string;
          owner_id: string;
          car_id: string;
          document_type: string;
          issuer: string | null;
          reference_number: string | null;
          issued_on: string | null;
          expires_on: string | null;
          status: string;
          notes: string | null;
          file_url: string | null;
          reminder_days: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          car_id: string;
          document_type: string;
          issuer?: string | null;
          reference_number?: string | null;
          issued_on?: string | null;
          expires_on?: string | null;
          status?: string;
          notes?: string | null;
          file_url?: string | null;
          reminder_days?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          owner_id?: string;
          car_id?: string;
          document_type?: string;
          issuer?: string | null;
          reference_number?: string | null;
          issued_on?: string | null;
          expires_on?: string | null;
          status?: string;
          notes?: string | null;
          file_url?: string | null;
          reminder_days?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "documents_owner_id_fkey";
            columns: ["owner_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
            isOneToOne: false;
          },
          {
            foreignKeyName: "documents_car_id_fkey";
            columns: ["car_id"];
            referencedRelation: "cars";
            referencedColumns: ["id"];
            isOneToOne: false;
          }
        ];
      };
      expenses: {
        Row: {
          id: string;
          owner_id: string;
          car_id: string;
          expense_date: string;
          category: string;
          amount: number;
          vendor: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          car_id: string;
          expense_date: string;
          category: string;
          amount: number;
          vendor?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          owner_id?: string;
          car_id?: string;
          expense_date?: string;
          category?: string;
          amount?: number;
          vendor?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "expenses_owner_id_fkey";
            columns: ["owner_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
            isOneToOne: false;
          },
          {
            foreignKeyName: "expenses_car_id_fkey";
            columns: ["car_id"];
            referencedRelation: "cars";
            referencedColumns: ["id"];
            isOneToOne: false;
          }
        ];
      };
      notifications: {
        Row: {
          id: string;
          owner_id: string;
          car_id: string | null;
          source_type: "document" | "service";
          source_id: string;
          trigger_kind: "due_30" | "due_7" | "due_today_or_overdue";
          due_at: string | null;
          message: string;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          car_id?: string | null;
          source_type: "document" | "service";
          source_id: string;
          trigger_kind: "due_30" | "due_7" | "due_today_or_overdue";
          due_at?: string | null;
          message: string;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          owner_id?: string;
          car_id?: string | null;
          source_type?: "document" | "service";
          source_id?: string;
          trigger_kind?: "due_30" | "due_7" | "due_today_or_overdue";
          due_at?: string | null;
          message?: string;
          read_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_owner_id_fkey";
            columns: ["owner_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
            isOneToOne: false;
          },
          {
            foreignKeyName: "notifications_car_id_fkey";
            columns: ["car_id"];
            referencedRelation: "cars";
            referencedColumns: ["id"];
            isOneToOne: false;
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      generate_verification_code: {
        Args: { p_user_id: string };
        Returns: string;
      };
      verify_code: {
        Args: { p_user_id: string; p_code: string };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
export type VerificationCodeRow = Database["public"]["Tables"]["verification_codes"]["Row"];
export type CarRow = Database["public"]["Tables"]["cars"]["Row"];
export type ServiceRecordRow = Database["public"]["Tables"]["service_records"]["Row"];
export type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];
export type ExpenseRow = Database["public"]["Tables"]["expenses"]["Row"];
export type NotificationRow = Database["public"]["Tables"]["notifications"]["Row"];

// Extended onboarding answers with new fields
export type OnboardingAnswers = {
  transmission_preference: string | null;
  car_body_preference: string | null;
  car_style_preference: string | null;
  fuel_consumption_priority: string | null;
  electric_future_preference: string | null;
  usage_type?: string | null;
  ownership_status?: string | null;
};

// Car creation input type
export type CarInput = {
  make: string;
  model: string;
  year?: number | null;
  license_plate?: string | null;
  vin?: string | null;
  color?: string | null;
  fuel_type?: string | null;
  transmission?: string | null;
  body_type?: string | null;
  engine_size?: string | null;
  horsepower?: number | null;
  image_url?: string | null;
  usage_type?: string | null;
  mileage?: number | null;
  is_primary?: boolean;
};

// Vehicle data from external API or manual entry
export type VehicleData = {
  make: string;
  model: string;
  year: number;
  body_type?: string;
  fuel_type?: string;
  transmission?: string;
  engine_size?: string;
  horsepower?: number;
  image_url?: string;
};
