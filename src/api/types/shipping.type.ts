// src/api/types/shipping.type.ts
export interface ShippingCarrier {
  id: number;
  name: string;
  code: string;
  contact_info: string | null;
  api_config: Record<string, any> | null; // JSONB
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}