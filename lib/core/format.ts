// CANONICAL: shared display helpers, labels, and option lists for FamComply pages.
// Pure functions and constants only. Safe in both server and client components.
import { daysFromTodayUtc, formatDateUtc } from '@/lib/db/dates'
import {
  US_STATE_CODES,
  type LicenseType,
  type RequirementKind,
  type RequirementStatus,
} from '@/lib/db/types'

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

export function formatDisplayDate(isoDate: string | null): string {
  if (!isoDate) {
    return 'No date yet'
  }
  return formatDateUtc(isoDate)
}

export function dueLabel(expiresOn: string | null, completedOn: string | null): string {
  if (completedOn) {
    return `Completed ${formatDateUtc(completedOn)}`
  }
  if (!expiresOn) {
    return 'No date yet'
  }
  const days = daysFromTodayUtc(expiresOn)
  if (days > 1) {
    return `${days} days left`
  }
  if (days === 1) {
    return 'Expires tomorrow'
  }
  if (days === 0) {
    return 'Expires today'
  }
  const overdueDays = Math.abs(days)
  return overdueDays === 1 ? '1 day overdue' : `${overdueDays} days overdue`
}

export function relativeDayLabel(isoDate: string): string {
  const days = daysFromTodayUtc(isoDate)
  if (days === 0) {
    return 'Today'
  }
  if (days === 1) {
    return 'Tomorrow'
  }
  if (days > 1) {
    return `In ${days} days`
  }
  const daysAgo = Math.abs(days)
  return daysAgo === 1 ? '1 day ago' : `${daysAgo} days ago`
}

export function priceLabel(cents: number): string {
  const dollars = cents / 100
  return Number.isInteger(dollars) ? `$${dollars}` : `$${dollars.toFixed(2)}`
}

export function subscriptionStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    active: 'Active',
    trialing: 'Trial',
    past_due: 'Past due',
    canceled: 'Canceled',
    incomplete: 'Incomplete',
    incomplete_expired: 'Expired',
    unpaid: 'Unpaid',
    paused: 'Paused',
    none: 'Free',
  }
  return labels[status] ?? status
}

export const KIND_LABELS: Record<RequirementKind, string> = {
  cpr_certification: 'CPR',
  first_aid_certification: 'First aid',
  background_check: 'Background check',
  continuing_education: 'Training hours',
  inspection_prep: 'Inspection prep',
  license_renewal: 'License renewal',
}

export const LICENSE_OPTIONS: ReadonlyArray<{ value: LicenseType; label: string }> = [
  { value: 'family_child_care', label: 'Family child care' },
  { value: 'group_family_child_care', label: 'Group family child care' },
  { value: 'large_family_child_care', label: 'Large family child care' },
  { value: 'other', label: 'Other license' },
]

export const STATUS_META: Record<
  RequirementStatus,
  { label: string; badge: string; dot: string; ring: string }
> = {
  not_started: {
    label: 'No date yet',
    badge: 'bg-slate-100 text-slate-700',
    dot: 'bg-slate-400',
    ring: 'border-slate-300 bg-white text-slate-500',
  },
  on_track: {
    label: 'On track',
    badge: 'bg-emerald-100 text-emerald-800',
    dot: 'bg-emerald-500',
    ring: 'border-emerald-400 bg-emerald-50 text-emerald-700',
  },
  due_soon: {
    label: 'Due soon',
    badge: 'bg-amber-100 text-amber-800',
    dot: 'bg-amber-500',
    ring: 'border-amber-400 bg-amber-50 text-amber-700',
  },
  overdue: {
    label: 'Overdue',
    badge: 'bg-rose-100 text-rose-800',
    dot: 'bg-rose-500',
    ring: 'border-rose-400 bg-rose-50 text-rose-700',
  },
  completed: {
    label: 'Done',
    badge: 'bg-teal-100 text-teal-800',
    dot: 'bg-teal-500',
    ring: 'border-teal-600 bg-teal-600 text-white',
  },
}

export const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  DC: 'District of Columbia',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  IA: 'Iowa',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  ME: 'Maine',
  MD: 'Maryland',
  MA: 'Massachusetts',
  MI: 'Michigan',
  MN: 'Minnesota',
  MS: 'Mississippi',
  MO: 'Missouri',
  MT: 'Montana',
  NE: 'Nebraska',
  NV: 'Nevada',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NY: 'New York',
  NC: 'North Carolina',
  ND: 'North Dakota',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VT: 'Vermont',
  VA: 'Virginia',
  WA: 'Washington',
  WV: 'West Virginia',
  WI: 'Wisconsin',
  WY: 'Wyoming',
  PR: 'Puerto Rico',
  VI: 'U.S. Virgin Islands',
  GU: 'Guam',
  AS: 'American Samoa',
  MP: 'Northern Mariana Islands',
}

export const STATE_OPTIONS: ReadonlyArray<{ code: string; name: string }> = US_STATE_CODES.map(
  (code) => ({ code, name: STATE_NAMES[code] ?? code })
)

export const TIMEZONE_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'America/New_York', label: 'Eastern (New York)' },
  { value: 'America/Chicago', label: 'Central (Chicago)' },
  { value: 'America/Denver', label: 'Mountain (Denver)' },
  { value: 'America/Phoenix', label: 'Arizona (Phoenix)' },
  { value: 'America/Los_Angeles', label: 'Pacific (Los Angeles)' },
  { value: 'America/Anchorage', label: 'Alaska (Anchorage)' },
  { value: 'Pacific/Honolulu', label: 'Hawaii (Honolulu)' },
  { value: 'America/Puerto_Rico', label: 'Atlantic (Puerto Rico)' },
]
