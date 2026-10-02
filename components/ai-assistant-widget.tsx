'use client'

import { useState, useRef, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Sparkles, MessageSquare, X, Send, Bot, User, Trash2, ArrowUpRight, HelpCircle } from 'lucide-react'
import Link from 'next/link'

interface Message {
  id: string
  sender: 'assistant' | 'user'
  text: string
  time: string
}

const INITIAL_MESSAGES: Message[] = [
  {
    id: 'welcome-1',
    sender: 'assistant',
    text: 'Hello! I am your QueueFlow AI Assistant built by LahootiX. How can I help you today? You can ask about booking appointments, walk-in tokens, department hours, or staff workflows.',
    time: 'Just now',
  },
]

const QUICK_SUGGESTIONS = [
  'How do I book an appointment?',
  'How do walk-in tokens work?',
  'What are department hours & breaks?',
  'How do I check in for my slot?',
]

export default function AiAssistantWidget() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>(INITIAL_MESSAGES)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    if (isOpen) {
      scrollToBottom()
    }
  }, [messages, isOpen])

  // Do not render floating widget on public display kiosk board
  // NOTE: this early return MUST come after all hooks to follow Rules of Hooks
  if (pathname === '/display' || pathname?.startsWith('/display')) {
    return null
  }

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || input).trim()
    if (!query || loading) return

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }

    setMessages((prev) => [...prev, userMsg])
    if (!textToSend) setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: query }),
      })

      if (res.ok) {
        const data = await res.json()
        const botMsg: Message = {
          id: `bot-${Date.now()}`,
          sender: 'assistant',
          text: data.reply || 'I am here to help you navigate QueueFlow.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
        setMessages((prev) => [...prev, botMsg])
      } else {
        throw new Error('Failed to get answer')
      }
    } catch {
      const errorMsg: Message = {
        id: `bot-${Date.now()}`,
        sender: 'assistant',
        text: 'You can book appointments at [Book Appointment](/book), request walk-in tokens at [Get Token](/token), and track your turn at [My Queue](/my).',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleClear = () => {
    setMessages(INITIAL_MESSAGES)
  }

  // Helper to parse markdown links [Text](url)
  const renderMessageContent = (text: string) => {
    const parts = []
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
    let lastIndex = 0
    let match

    while ((match = linkRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index))
      }
      const label = match[1]
      const url = match[2]
      parts.push(
        <Link
          key={`${url}-${match.index}`}
          href={url}
          onClick={() => setIsOpen(false)}
          className="text-[#16A34A] underline font-semibold hover:text-[#15803D] inline-flex items-center gap-0.5"
        >
          {label}
          <ArrowUpRight className="w-3 h-3" />
        </Link>
      )
      lastIndex = linkRegex.lastIndex
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex))
    }

    return parts.length > 0 ? parts : text
  }

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {/* Floating launcher trigger */}
      {!isOpen && (
        <button
          type="button"
          id="open-ai-assistant-btn"
          onClick={() => setIsOpen(true)}
          className="flex items-center gap-2 bg-[#22C55E] hover:bg-[#16A34A] text-white py-3 px-4 rounded-full shadow-xl shadow-green-500/25 transition-all hover:scale-105 cursor-pointer group"
          title="Ask QueueFlow AI Assistant"
          aria-label="Ask QueueFlow AI Assistant"
        >
          <div className="relative">
            <Sparkles className="w-5 h-5 text-white" />
            <span className="absolute -top-1 -right-1 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
            </span>
          </div>
          <span className="text-sm font-bold tracking-tight pr-1">
            AI Assistant
          </span>
        </button>
      )}

      {/* Interactive Chat Window */}
      {isOpen && (
        <div className="w-[340px] sm:w-[390px] h-[520px] max-h-[85vh] bg-white rounded-3xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-6 duration-200">
          {/* Header */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white px-5 py-4 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center backdrop-blur-xs">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-bold text-sm leading-none">QueueFlow Assistant</h3>
                  <span className="w-2 h-2 rounded-full bg-emerald-300" />
                </div>
                <p className="text-[11px] text-emerald-100 mt-1">Built by LahootiX</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleClear}
                className="p-1.5 rounded-lg text-emerald-100 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Clear conversation"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-emerald-100 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Close chat"
                aria-label="Close assistant"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Messages body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#F9FAFB]/70 text-gray-900 text-xs">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-2.5 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {m.sender === 'assistant' && (
                  <div className="w-6 h-6 rounded-lg bg-[#22C55E]/10 text-[#16A34A] flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles className="w-3.5 h-3.5" />
                  </div>
                )}
                <div
                  className={`max-w-[82%] rounded-2xl p-3 leading-relaxed ${
                    m.sender === 'user'
                      ? 'bg-[#22C55E] text-white font-medium rounded-br-xs shadow-xs'
                      : 'bg-white border border-gray-100 text-gray-800 rounded-bl-xs shadow-xs'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{renderMessageContent(m.text)}</p>
                  <span
                    className={`block text-[9px] mt-1 text-right ${
                      m.sender === 'user' ? 'text-green-100' : 'text-gray-400'
                    }`}
                  >
                    {m.time}
                  </span>
                </div>
                {m.sender === 'user' && (
                  <div className="w-6 h-6 rounded-lg bg-gray-200 text-gray-600 flex items-center justify-center shrink-0 mt-0.5">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-2.5 items-center text-gray-400 text-xs">
                <div className="w-6 h-6 rounded-lg bg-[#22C55E]/10 text-[#16A34A] flex items-center justify-center shrink-0">
                  <Sparkles className="w-3.5 h-3.5 animate-spin" />
                </div>
                <div className="bg-white border border-gray-100 rounded-2xl py-2 px-3 flex items-center gap-1.5 shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-bounce" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-bounce [animation-delay:0.2s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick suggestions */}
          <div className="px-3 py-2 bg-white border-t border-gray-100 overflow-x-auto flex gap-1.5 no-scrollbar">
            {QUICK_SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleSendMessage(s)}
                disabled={loading}
                className="shrink-0 text-[11px] font-medium bg-gray-50 hover:bg-emerald-50 hover:text-[#16A34A] border border-gray-200 hover:border-emerald-200 text-gray-600 px-2.5 py-1 rounded-full transition-all cursor-pointer disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>

          {/* Input field */}
          <div className="p-3 bg-white border-t border-gray-100 flex items-center gap-2">
            <input
              id="ai-assistant-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about QueueFlow..."
              disabled={loading}
              maxLength={500}
              className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#22C55E] focus:border-transparent transition-all"
            />
            <button
              type="button"
              id="ai-assistant-send-btn"
              onClick={() => handleSendMessage()}
              disabled={!input.trim() || loading}
              className="w-9 h-9 rounded-xl bg-[#22C55E] hover:bg-[#16A34A] text-white flex items-center justify-center shrink-0 shadow-md shadow-green-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
