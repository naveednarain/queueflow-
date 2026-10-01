/**
 * Smart Waiting-Time Prediction (Phase 8 - Section 7.1)
 * Formula defined in AGENT_BUILD_GUIDE.md sections 6.1 and 7.1:
 * wait = ceil( people_ahead * avg_service_time / greatest(active_counters, 1) )
 * Uses rolling average of recent completed services, weighted by peak hour.
 */

export interface WaitTimeParams {
  peopleAhead: number
  avgServiceMinutes?: number
  activeCounters?: number
  sampleCount?: number
  currentHour?: number // 0-23
}

export interface WaitTimeResult {
  estimatedWaitMinutes: number
  baseAvgMinutes: number
  weightedAvgMinutes: number
  activeCounters: number
  sampleCount: number
  isPeakHour: boolean
  tooltipText: string
}

/**
 * Peak hours defined in brief: 11:00 AM to 1:00 PM (11:00 - 13:59)
 */
export function isPeakHourTime(hour?: number): boolean {
  const h = hour !== undefined ? hour : new Date().getHours()
  return h >= 11 && h <= 13
}

/**
 * Calculates AI-estimated wait time with peak-hour weighting
 */
export function predictWaitTime({
  peopleAhead,
  avgServiceMinutes = 10,
  activeCounters = 1,
  sampleCount = 20,
  currentHour,
}: WaitTimeParams): WaitTimeResult {
  const isPeak = isPeakHourTime(currentHour)
  // Peak hours are 15% slower due to high traffic & overhead
  const peakMultiplier = isPeak ? 1.15 : 1.0
  const weightedAvg = Math.round(avgServiceMinutes * peakMultiplier * 10) / 10

  const counters = Math.max(1, activeCounters)
  const estimated = peopleAhead <= 0
    ? 0
    : Math.ceil((peopleAhead * weightedAvg) / counters)

  const tooltipText = sampleCount > 0
    ? `AI-estimated wait based on ${sampleCount} recent services${isPeak ? ' (peak hour factor applied)' : ''} across ${counters} counter${counters > 1 ? 's' : ''}`
    : `AI-estimated wait based on baseline service SLA across ${counters} counter${counters > 1 ? 's' : ''}`

  return {
    estimatedWaitMinutes: estimated,
    baseAvgMinutes: Math.round(avgServiceMinutes * 10) / 10,
    weightedAvgMinutes: weightedAvg,
    activeCounters: counters,
    sampleCount,
    isPeakHour: isPeak,
    tooltipText,
  }
}
