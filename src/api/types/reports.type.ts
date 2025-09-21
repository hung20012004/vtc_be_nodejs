export interface Report {
  id: number;
  name: string;
  type: string;
  data: any; // JSONB
  generated_at: Date;
}