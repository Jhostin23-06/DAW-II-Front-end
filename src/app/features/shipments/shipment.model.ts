export interface Shipment {
  id?: string;
  orderNumber: string;
  categoryId: string;
  description: string;
  price: number;
  weight: number;
  volume: number;
  origin: string;
  destination: string;
  status: string;
  atDate: string;
  clientId: string;
  transportId: string;
}
