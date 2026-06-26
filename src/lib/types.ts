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

export interface StopItem {
  name: string;
  qty: number;
  weight: string;
  fragile?: boolean;
}

export interface Stop {
  id: string;
  type: StopType;
  label: string;
  address: string;
  customer?: string;
  eta: string;
  items?: StopItem[];
  notes?: string;
  latitude?: number | null;
  longitude?: number | null;
  sequence?: number;
  is_completed?: boolean;
  /** Set on trip drop-offs so delivery can target the right assignment. */
  assignment_id?: string;
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
