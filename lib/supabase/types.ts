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
    };
    Views: {};
    Functions: {};
    Enums: {};
    CompositeTypes: {};
  };
};
