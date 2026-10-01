/**
 * Heuristic No-Show Risk Predictor (Phase 3 & Phase 8)
 * Formula defined in AGENT_BUILD_GUIDE.md section 7.2
 */

export interface NoShowRiskInput {
  noShowCount?: number
  bookedHoursBeforeSlot?: number
  isEarlyOrLastSlot?: boolean
  hasCancelledOrRescheduledBefore?: boolean
}

export function calculateNoShowRisk(input: NoShowRiskInput): number {
  let risk = 0.10

  // + min(0.45, 0.15 * user.no_show_count)
  const noShowCount = input.noShowCount ?? 0
  risk += Math.min(0.45, 0.15 * noShowCount)

  // + (booked less than 2 hours before the slot ? 0.20 : 0)
  if (input.bookedHoursBeforeSlot !== undefined && input.bookedHoursBeforeSlot < 2) {
    risk += 0.20
  }

  // + (slot is early morning or last slot of day ? 0.10 : 0)
  if (input.isEarlyOrLastSlot) {
    risk += 0.10
  }

  // + (user has cancelled/rescheduled this appointment before ? 0.10 : 0)
  if (input.hasCancelledOrRescheduledBefore) {
    risk += 0.10
  }

  // clamp to [0, 1] rounded to 2 decimal places
  return Math.min(1, Math.max(0, Math.round(risk * 100) / 100))
}

export interface NoShowBadgeData {
  label: 'Low Risk' | 'Medium Risk' | 'High Risk'
  scorePercent: number
  color: 'emerald' | 'amber' | 'rose'
  badgeClass: string
  dotClass: string
}

export function getNoShowBadge(riskScore: number | null | undefined): NoShowBadgeData {
  const risk = riskScore ?? 0.10
  const scorePercent = Math.round(risk * 100)

  if (risk < 0.3) {
    return {
      label: 'Low Risk',
      scorePercent,
      color: 'emerald',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800',
      dotClass: 'bg-emerald-500',
    }
  }

  if (risk <= 0.6) {
    return {
      label: 'Medium Risk',
      scorePercent,
      color: 'amber',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800',
      dotClass: 'bg-amber-500',
    }
  }

  return {
    label: 'High Risk',
    scorePercent,
    color: 'rose',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800',
    dotClass: 'bg-rose-500',
  }
}
