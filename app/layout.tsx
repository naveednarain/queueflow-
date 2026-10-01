import type { Metadata } from 'next'
import { Inter, Geist } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

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
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  )
}
