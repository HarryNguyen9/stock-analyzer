export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      symbols: {
        Row: {
          symbol: string;
          name: string;
          exchange: "HOSE" | "HNX" | "UPCOM";
          sector: string;
          tier: "A" | "B" | "C";
          auto_sync: boolean;
          liquidity_rank: number | null;
          last_synced_at: string | null;
          sync_status: string | null;
          retry_count: number;
          last_error: string | null;
          next_retry_at: string | null;
          is_active: boolean;
          metadata_updated_at: string | null;
          unsupported_at: string | null;
          unsupported_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          symbol: string;
          name: string;
          exchange: "HOSE" | "HNX" | "UPCOM";
          sector: string;
          tier?: "A" | "B" | "C";
          auto_sync?: boolean;
          liquidity_rank?: number | null;
          last_synced_at?: string | null;
          sync_status?: string | null;
          retry_count?: number;
          last_error?: string | null;
          next_retry_at?: string | null;
          is_active?: boolean;
          metadata_updated_at?: string | null;
          unsupported_at?: string | null;
          unsupported_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          symbol?: string;
          name?: string;
          exchange?: "HOSE" | "HNX" | "UPCOM";
          sector?: string;
          tier?: "A" | "B" | "C";
          auto_sync?: boolean;
          liquidity_rank?: number | null;
          last_synced_at?: string | null;
          sync_status?: string | null;
          retry_count?: number;
          last_error?: string | null;
          next_retry_at?: string | null;
          is_active?: boolean;
          metadata_updated_at?: string | null;
          unsupported_at?: string | null;
          unsupported_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      stock_prices: {
        Row: {
          id: number;
          symbol: string;
          date: string;
          open: number;
          high: number;
          low: number;
          close: number;
          volume: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          symbol: string;
          date: string;
          open: number;
          high: number;
          low: number;
          close: number;
          volume: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          symbol?: string;
          date?: string;
          open?: number;
          high?: number;
          low?: number;
          close?: number;
          volume?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      technical_indicators: {
        Row: {
          id: number;
          symbol: string;
          date: string;
          sma20: number | null;
          sma50: number | null;
          rsi14: number | null;
          volume_average20: number | null;
          technical_score: number | null;
          signals: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: number;
          symbol: string;
          date: string;
          sma20?: number | null;
          sma50?: number | null;
          rsi14?: number | null;
          volume_average20?: number | null;
          technical_score?: number | null;
          signals?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: number;
          symbol?: string;
          date?: string;
          sma20?: number | null;
          sma50?: number | null;
          rsi14?: number | null;
          volume_average20?: number | null;
          technical_score?: number | null;
          signals?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      sync_jobs: {
        Row: {
          id: string;
          job_type: string;
          status: string;
          started_at: string;
          finished_at: string | null;
          duration_ms: number | null;
          selected_count: number;
          success_count: number;
          failed_count: number;
          error_message: string | null;
          metadata: Json | null;
        };
        Insert: {
          id?: string;
          job_type: string;
          status: string;
          started_at?: string;
          finished_at?: string | null;
          duration_ms?: number | null;
          selected_count?: number;
          success_count?: number;
          failed_count?: number;
          error_message?: string | null;
          metadata?: Json | null;
        };
        Update: {
          id?: string;
          job_type?: string;
          status?: string;
          started_at?: string;
          finished_at?: string | null;
          duration_ms?: number | null;
          selected_count?: number;
          success_count?: number;
          failed_count?: number;
          error_message?: string | null;
          metadata?: Json | null;
        };
        Relationships: [];
      };
      market_snapshots: {
        Row: {
          id: string;
          snapshot_type: string;
          data: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          snapshot_type: string;
          data: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          snapshot_type?: string;
          data?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      market_snapshot_history: {
        Row: {
          id: string;
          snapshot_type: string;
          data: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          snapshot_type: string;
          data: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          snapshot_type?: string;
          data?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      covered_warrants: {
        Row: {
          symbol: string;
          underlying_symbol: string;
          issuer: string | null;
          type: string | null;
          strike_price: number | null;
          exercise_ratio: number | null;
          maturity_date: string | null;
          last_price: number | null;
          change_percent: number | null;
          bid: number | null;
          ask: number | null;
          volume: number | null;
          open_interest: number | null;
          underlying_price: number | null;
          sx_value: number | null;
          break_even_price: number | null;
          days_to_maturity: number | null;
          is_active: boolean;
          source: string | null;
          raw: Json | null;
          updated_at: string;
        };
        Insert: {
          symbol: string;
          underlying_symbol: string;
          issuer?: string | null;
          type?: string | null;
          strike_price?: number | null;
          exercise_ratio?: number | null;
          maturity_date?: string | null;
          last_price?: number | null;
          change_percent?: number | null;
          bid?: number | null;
          ask?: number | null;
          volume?: number | null;
          open_interest?: number | null;
          underlying_price?: number | null;
          sx_value?: number | null;
          break_even_price?: number | null;
          days_to_maturity?: number | null;
          is_active?: boolean;
          source?: string | null;
          raw?: Json | null;
          updated_at?: string;
        };
        Update: {
          symbol?: string;
          underlying_symbol?: string;
          issuer?: string | null;
          type?: string | null;
          strike_price?: number | null;
          exercise_ratio?: number | null;
          maturity_date?: string | null;
          last_price?: number | null;
          change_percent?: number | null;
          bid?: number | null;
          ask?: number | null;
          volume?: number | null;
          open_interest?: number | null;
          underlying_price?: number | null;
          sx_value?: number | null;
          break_even_price?: number | null;
          days_to_maturity?: number | null;
          is_active?: boolean;
          source?: string | null;
          raw?: Json | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {};
    Functions: {};
    Enums: {};
    CompositeTypes: {};
  };
};
