/**
 * Smart Staff & Counter Recommendation (Phase 8 - Section 7.4)
 * Formula: recommended_counters = ceil(expected_demand_per_hour * avg_service_minutes / 60)
 * Where expected demand is the historical average tokens for that hour and weekday.
 */

export interface StaffRecommendationParams {
  activeCounters: number
  avgServiceMinutes?: number
  currentHour?: number // 0-23
  historicalDemandPerHour?: number
}

export interface StaffRecommendationResult {
  currentHourStr: string
  currentHour: number
  recommendedCounters: number
  activeCounters: number
  expectedDemandPerHour: number
  avgServiceMinutes: number
  difference: number // recommended - active
  status: 'optimal' | 'understaffed' | 'surplus'
  headline: string
  actionMessage: string
}

/**
 * Standard demand curve based on bank/clinic/office historical patterns:
 * Peak at 11 AM - 1 PM.
 */
function getBaselineDemandForHour(hour: number): number {
  if (hour === 9) return 10
  if (hour === 10) return 18
  if (hour === 11) return 24 // Peak
  if (hour === 12) return 26 // Peak
  if (hour === 13) return 20 // Break / rush
  if (hour === 14) return 16
  if (hour === 15) return 14
  if (hour === 16) return 8
  return 6 // default off-peak
}

export function formatHourAmPm(hour: number): string {
  const h = hour % 24
  if (h === 0) return '12 AM'
  if (h < 12) return `${h} AM`
  if (h === 12) return '12 PM'
  return `${h - 12} PM`
}

export function computeStaffRecommendation({
  activeCounters,
  avgServiceMinutes = 10,
  currentHour,
  historicalDemandPerHour,
}: StaffRecommendationParams): StaffRecommendationResult {
  const now = new Date()
  const hour = currentHour !== undefined ? currentHour : now.getHours()
  const hourStr = formatHourAmPm(hour)

  // Use provided historical demand or realistic venue curve
  const expectedDemand = historicalDemandPerHour && historicalDemandPerHour > 0
    ? historicalDemandPerHour
    : getBaselineDemandForHour(hour)

  // Formula: ceil(expected_demand_per_hour * avg_service_minutes / 60)
  const recommended = Math.max(1, Math.ceil((expectedDemand * avgServiceMinutes) / 60))
  const active = Math.max(0, activeCounters)
  const diff = recommended - active

  let status: 'optimal' | 'understaffed' | 'surplus' = 'optimal'
  let actionMessage = 'Staffing matches anticipated throughput. Queue wait times expected within target SLA.'

  if (diff > 0) {
    status = 'understaffed'
    actionMessage = `Open ${diff} more counter${diff > 1 ? 's' : ''} to absorb expected visitor volume and prevent queue buildup.`
  } else if (diff < 0) {
    status = 'surplus'
    actionMessage = `Sufficient counter capacity. ${Math.abs(diff)} counter${Math.abs(diff) > 1 ? 's' : ''} may be reassigned or placed on standby.`
  }

  const headline = `Recommended active counters at ${hourStr}: ${recommended} (currently ${active})`

  return {
    currentHourStr: hourStr,
    currentHour: hour,
    recommendedCounters: recommended,
    activeCounters: active,
    expectedDemandPerHour: expectedDemand,
    avgServiceMinutes,
    difference: diff,
    status,
    headline,
    actionMessage,
  }
}
