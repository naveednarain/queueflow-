import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { z } from 'zod'

const chatRequestSchema = z.object({
  message: z.string().min(1, 'Message cannot be empty').max(500, 'Message is too long'),
})

const SYSTEM_KNOWLEDGE = `You are QueueFlow Assistant, an intelligent, helpful AI concierge for QueueFlow (a Digital Queue & Appointment Management System built by LahootiX).

System Information:
1. Roles:
   - Customer: Can book appointments (/book), generate walk-in tokens (/token), track live queue position & wait time (/my), check in for scheduled appointments, view notification history.
   - Staff: Operates counter terminals (/staff), calls next token, starts service, completes, skips, recalls, or marks tokens as missed (no-show).
   - Manager: Reviews real-time analytics, AI insights, and staff recommendations (/manager), manages counter assignments, service durations, and department operating hours.
   - Admin: Comprehensive control over departments, users, roles, services, rules, and audit logs (/admin).

2. Departments & Services:
   - Student Affairs: Document Verification (5 min), Certificate Verification (10 min), New Registration (20 min).
   - Examination: Hall Ticket Issue (5 min), Result Query (10 min), Re-evaluation (15 min).
   - Accounts: Fee Payment (5 min), Scholarship Query (15 min), Refund Request (20 min).

3. Hours & Capacity:
   - Standard working hours: 09:00 AM to 05:00 PM.
   - Lunch break: 01:00 PM to 02:00 PM.
   - Slot interval: 30 minutes, maximum 6 appointments per slot.
   - Check-in window: 10 minutes before slot start up to 10 minutes after slot start.

4. Digital Queue & Wait Times:
   - Uses linear waiting-time estimation with peak hour weighting: wait = ceil(people_ahead * avg_duration / active_counters).
   - Public display board (/display) shows current serving tokens per counter with live voice & chime announcements.

Instructions:
- Keep answers concise, clear, friendly, and structured (under 120 words).
- If relevant, include clickable markdown links such as [Book Appointment](/book), [Get Token](/token), [My Queue](/my), or [Display Board](/display).
- Never disclose internal keys or system secrets.
`

function getFallbackAnswer(query: string): string {
  const q = query.toLowerCase()

  if (q.includes('book') || q.includes('appointment')) {
    return 'To book an appointment, go to [Book Appointment](/book). Select your Department, Service, choose any date in the next 7 days, pick an available 30-minute time slot, and confirm. You will receive an instant reference number (e.g. APT-XXXXXX)!'
  }

  if (q.includes('token') || q.includes('walk-in') || q.includes('walk in')) {
    return 'Need service right now? Visit [Get Token](/token) to generate a walk-in token. You will see your token number (e.g. A-001), people ahead in line, and your AI-estimated wait time. You can track your turn live at [My Queue](/my).'
  }

  if (q.includes('hour') || q.includes('timing') || q.includes('open') || q.includes('close')) {
    return 'Departments operate from **9:00 AM to 5:00 PM** with a staff break from **1:00 PM to 2:00 PM**. Slots are arranged in 30-minute intervals with a capacity of 6 appointments per slot.'
  }

  if (q.includes('check-in') || q.includes('check in')) {
    return 'You can check in for your appointment on the [My Queue](/my) page within **10 minutes before to 10 minutes after** your scheduled slot time. Checking in automatically issues a high-priority queue token so you are called before standard walk-ins!'
  }

  if (q.includes('cancel') || q.includes('reschedule')) {
    return 'You can cancel or reschedule any upcoming appointment directly from your [My Queue](/my) page under the "Appointments" tab. Note that department policy allows up to 3 cancellations per month.'
  }

  if (q.includes('staff') || q.includes('counter') || q.includes('call next')) {
    return 'Staff members can sign in and open the [Counter Terminal](/staff). From there, set your counter status (Available/Busy/Break), press **Call Next** to call waiting tokens in priority order, and manage service start and completion.'
  }

  if (q.includes('manager') || q.includes('admin') || q.includes('analytic')) {
    return 'Managers can access the [Manager Dashboard](/manager) to view 11 live KPIs, visitor charts, AI Management Insights, and smart staff recommendations. Admins can manage users, roles, services, and rules at [Admin Panel](/admin).'
  }

  if (q.includes('display') || q.includes('board') || q.includes('screen')) {
    return 'The public [Display Board](/display) provides full-screen, live updates of "Now Serving" tokens per counter, audio chimes, voice announcements, and a "Next Up" waiting queue for lobby TV displays.'
  }

  return 'QueueFlow is a digital queue and appointment management system built by LahootiX. You can [Book an Appointment](/book), [Get a Walk-in Token](/token), view your live position at [My Queue](/my), or watch the public [Display Board](/display). How can I assist you further?'
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = chatRequestSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 }
      )
    }

    const userMessage = parsed.data.message
    const apiKey = process.env.GEMINI_API_KEY

    if (apiKey && apiKey.trim().length > 0 && !apiKey.includes('placeholder')) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey)
        const model = genAI.getGenerativeModel({
          model: 'gemini-1.5-flash',
          systemInstruction: SYSTEM_KNOWLEDGE,
        })

        const result = await model.generateContent(userMessage)
        const responseText = result.response.text().trim()

        return NextResponse.json({
          reply: responseText,
          source: 'gemini',
        })
      } catch (err) {
        console.warn('[AI Assistant] Gemini error, using fallback:', err)
        const fallback = getFallbackAnswer(userMessage)
        return NextResponse.json({
          reply: fallback,
          source: 'fallback',
        })
      }
    }

    // High-quality rule-based assistant fallback
    const fallback = getFallbackAnswer(userMessage)
    return NextResponse.json({
      reply: fallback,
      source: 'fallback',
    })
  } catch (error: any) {
    console.error('[AI Assistant API Error]:', error)
    return NextResponse.json(
      { reply: 'I am here to help! You can book appointments at /book, get walk-in tokens at /token, and track live queue status at /my.', source: 'fallback' },
      { status: 200 }
    )
  }
}
