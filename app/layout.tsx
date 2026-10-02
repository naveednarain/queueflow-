import type { Metadata, Viewport } from 'next'
import { Inter, Geist } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'
import { cn } from "@/lib/utils";
import AiAssistantWidget from '@/components/ai-assistant-widget'
import NavigationProgress from '@/components/navigation-progress'

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#22C55E',
}

export const metadata: Metadata = {
  title: 'QueueFlow – Digital Queue & Appointment Management',
  description:
    'Book appointments and join digital queues at banks, clinics, universities, and government offices. No more waiting in line.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={cn("h-full", inter.variable, "font-sans", geist.variable)}>
      <body className="min-h-full font-sans antialiased bg-[#F5F5F5] text-gray-900">
        {/* Green progress bar at top — shows instantly on every navigation */}
        <NavigationProgress />
        {children}
        <AiAssistantWidget />
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
