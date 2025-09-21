export interface PaymentGateway {
  id: number;
  name: string;
  code: string;
  is_active: boolean;
}