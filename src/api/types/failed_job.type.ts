// src/api/types/job.type.ts
export interface FailedJob {
  id: number;
  uuid: string;
  connection: string;
  queue: string;
  payload: string; // Thường là JSON string
  exception: string;
  failed_at: Date;
}