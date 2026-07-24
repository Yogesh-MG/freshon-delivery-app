export type DeliveryServiceType = "swift" | "next-day" | "standard";
export type MissionStatus = "PENDING" | "ACCEPTED" | "PICKED_UP" | "IN_TRANSIT" | "DELIVERED";
export type StopType = "pickup" | "dropoff";

export interface DeliveryAuthUser {
  id: number;
  username: string;
  email: string;
  role: "DELIVERY" | "PICKER" | "ADMIN" | "CUSTOMER" | "FARMER" | "POS_OPERATOR";
  is_profile_complete?: boolean;
}

export interface Stop {
  id: string;
  type: StopType;
  label: string;
  address: string;
  customer?: string;
  eta: string;
  notes?: string;
  latitude?: number | null;
  longitude?: number | null;
  sequence?: number;
  is_completed?: boolean;
  /** Set on trip drop-offs so delivery can target the right assignment. */
  assignment_id?: string;
  /** Human order id (tracking id) the rider can quote — drop-offs only. */
  order_id?: string | null;
  /** Number to reach the customer at the door. */
  customer_phone?: string;
  /** Total parcel weight in kg. The rider is told weight, never contents. */
  weight_kg?: number | null;
  /** How many bags/lines to carry — a count, never the products. */
  parcel_count?: number;
}

export interface Assignment {
  id: string;
  service: DeliveryServiceType;
  earnings: number;
  distance_km: number;
  weight_kg: number;
  stops: Stop[];
  fee: { weight: number; distance: number; premium: number };
  status: MissionStatus;
}

export interface EarningsStats {
  earnings: number;
  goal: number;
  deliveries: number;
  distance: number;
  rating: number;
}

export interface ApiResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}
