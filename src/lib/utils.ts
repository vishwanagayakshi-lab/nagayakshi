import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, formatDistanceToNow, isPast } from 'date-fns';
import type { BookingStatus, EventStatus } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function paise(amount: number): string {
  return `₹${(amount / 100).toLocaleString('en-IN')}`;
}

export function toPaise(rupees: number): number {
  return Math.round(rupees * 100);
}

export function fmtDate(d: string | Date): string {
  return format(new Date(d), 'dd MMM yyyy');
}

export function fmtDateTime(d: string | Date): string {
  return format(new Date(d), 'dd MMM yyyy, hh:mm a');
}

export function timeAgo(d: string | Date): string {
  return formatDistanceToNow(new Date(d), { addSuffix: true });
}

export function isExpired(d: string | Date): boolean {
  return isPast(new Date(d));
}

export function secondsLeft(expiresAt: string): number {
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

export const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  draft:     'Draft',
  scheduled: 'Scheduled',
  open:      'Open',
  paused:    'Paused',
  closed:    'Closed',
  completed: 'Completed',
  archived:  'Archived',
  cancelled: 'Cancelled',
};

export const EVENT_STATUS_COLOR: Record<EventStatus, string> = {
  draft:     'bg-gray-100 text-gray-700',
  scheduled: 'bg-blue-100 text-blue-700',
  open:      'bg-green-100 text-green-700',
  paused:    'bg-yellow-100 text-yellow-700',
  closed:    'bg-orange-100 text-orange-700',
  completed: 'bg-purple-100 text-purple-700',
  archived:  'bg-gray-200 text-gray-500',
  cancelled: 'bg-red-100 text-red-700',
};

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  pending:      'Pending',
  payment_init: 'Payment Initiated',
  confirmed:    'Confirmed',
  failed:       'Payment Failed',
  expired:      'Expired',
  cancelled:    'Cancelled',
  refunded:     'Refunded',
};

export const BOOKING_STATUS_COLOR: Record<BookingStatus, string> = {
  pending:      'bg-yellow-100 text-yellow-700',
  payment_init: 'bg-blue-100 text-blue-700',
  confirmed:    'bg-green-100 text-green-700',
  failed:       'bg-red-100 text-red-700',
  expired:      'bg-gray-100 text-gray-500',
  cancelled:    'bg-red-50 text-red-400',
  refunded:     'bg-purple-100 text-purple-700',
};

export function phoneNormalize(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return digits.startsWith('91') ? `+${digits}` : `+91${digits}`;
}

export function maskPhone(phone: string): string {
  return phone.replace(/(\+?\d{2})(\d{4})(\d{4})(\d*)/, '$1 ****$3');
}
