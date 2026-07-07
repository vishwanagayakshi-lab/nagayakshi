export type EventStatus = 'draft' | 'scheduled' | 'open' | 'paused' | 'closed' | 'completed' | 'archived' | 'cancelled';
export type BookingStatus = 'pending' | 'payment_init' | 'confirmed' | 'failed' | 'expired' | 'cancelled' | 'refunded';
export type BookingType = 'online' | 'phone';
export type TokenType = 'online' | 'phone';

export interface MuttuEvent {
  id: string;
  name: string;
  description?: string;
  event_date: string;
  event_time?: string;
  total_tokens: number;
  online_tokens: number;
  phone_tokens: number;
  max_per_person: number;
  price_per_muttu: number;
  booking_opens_at?: string;
  booking_closes_at?: string;
  status: EventStatus;
  location?: string;
  notes?: string;
  display_notes?: string;
  confirmed_online: number;
  confirmed_phone: number;
  created_at: string;
  updated_at: string;
}

export interface Booking {
  id: string;
  booking_ref: string;
  event_id: string;
  user_id: string;
  phone: string;
  booking_type: BookingType;
  quantity: number;
  total_amount: number;
  status: BookingStatus;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  screenshot_url?: string;
  token_numbers?: number[];
  cancel_reason?: string;
  admin_notes?: string;
  expires_at?: string;
  confirmed_at?: string;
  created_at: string;
  updated_at: string;
  event?: MuttuEvent | unknown;
  muttu_items?: MuttuItem[];
}

export interface MuttuItem {
  id: string;
  booking_id: string;
  token_pool_id?: string;
  token_number?: number;
  name: string;
  nakshatra: string;
  obstacles: string;
  created_at: string;
}

export interface Profile {
  id: string;
  phone: string;
  name?: string;
  is_admin: boolean;
  is_banned: boolean;
  created_at: string;
}

export interface TokenPool {
  id: string;
  event_id: string;
  token_type: TokenType;
  token_number: number;
  status: 'available' | 'reserved' | 'confirmed' | 'cancelled';
  booking_id?: string;
  reserved_at?: string;
  expires_at?: string;
}

export interface Nakshatra {
  key: string;
  sanskrit: string;
  tamil: string;
  malayalam: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: Record<string, unknown>;
}
