export interface PasswordReset {
  email: string;
  token: string;
  created_at?: Date;
}