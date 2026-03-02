'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Mic, MicOff, Gamepad2, Sparkles, RefreshCw, MessageSquare, Settings } from 'lucide-react'
import { GameConfig, SPEED_MIN, SPEED_MAX } from '@/lib/types'

type AppState = 'idle' | 'listening' | 'thinking' | 'playing'
type ActiveTab = 'chat' | 'settings'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// ── Settings sub-components ────────────────────────────────────────────────

function SettingsRow({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-750 rounded-xl px-3 py-3 border border-gray-700">
      <div className="text-xs text-gray-500 mb-1.5">{icon} {label}</div>
      <div>{children}</div>
    </div>
  )
}

function EmojiInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-14 h-10 text-center text-2xl bg-gray-700 border border-gray-600 rounded-xl focus:outline-none focus:border-blue-400 transition-colors"
      placeholder="😀"
      title="Paste or type an emoji"
    />
  )
}

function ColorInput({ hex, onChange }: { hex: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer group w-fit">
      <div
        className="w-8 h-8 rounded-lg border-2 border-gray-600 group-hover:border-blue-400 transition-colors flex-shrink-0 relative overflow-hidden"
        style={{ backgroundColor: hex }}
        title="Click to open color picker"
      >
        <input
          type="color"
          value={hex}
          onChange={e => onChange(e.target.value)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>
      <span className="text-gray-300 font-mono text-xs">{hex}</span>
      <span className="text-xs text-gray-600 group-hover:text-gray-400 transition-colors">click swatch</span>
    </label>
  )
}

function SettingsPanel({ config, onConfigChange }: {
  config: GameConfig | null
  onConfigChange: (config: GameConfig) => void
}) {
  if (!config) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="text-center text-gray-500 text-sm">
          <div className="text-3xl mb-3">⚙️</div>
          <p>Make a game first</p>
          <p className="text-xs mt-1 text-gray-600">Settings will appear here</p>
        </div>
      </div>
    )
  }

  const update = <K extends keyof GameConfig>(field: K, value: GameConfig[K]) => {
    onConfigChange({ ...config, [field]: value })
  }

  const pct = Math.round(((config.speed - SPEED_MIN) / (SPEED_MAX - SPEED_MIN)) * 100)
  const speedTrackColor = pct < 40 ? 'bg-green-500' : pct < 70 ? 'bg-yellow-500' : 'bg-red-500'

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-2">
      <p className="text-xs text-gray-500 mb-3 px-1">Edit settings directly — updates the game live ✨</p>

      <SettingsRow icon="📛" label="Title">
        <input
          type="text"
          value={config.title}
          onChange={e => update('title', e.target.value)}
          maxLength={20}
          className="w-full bg-gray-700 text-white rounded-lg px-2.5 py-1.5 text-sm font-semibold border border-gray-600 focus:outline-none focus:border-blue-400 transition-colors"
          placeholder="Game title…"
        />
      </SettingsRow>

      <div className="flex gap-2">
        <div className="flex-1">
          <SettingsRow icon="🎮" label="Hero">
            <EmojiInput value={config.heroEmoji} onChange={v => update('heroEmoji', v)} />
          </SettingsRow>
        </div>
        <div className="flex-1">
          <SettingsRow icon="😈" label="Enemy">
            <EmojiInput value={config.enemyEmoji} onChange={v => update('enemyEmoji', v)} />
          </SettingsRow>
        </div>
      </div>

      <SettingsRow icon="⚡" label={`Speed · ${config.speed}`}>
        <div className="space-y-1.5 pt-0.5">
          <input
            type="range"
            min={SPEED_MIN}
            max={SPEED_MAX}
            step={5}
            value={config.speed}
            onChange={e => update('speed', parseInt(e.target.value))}
            className="w-full accent-blue-500 cursor-pointer"
          />
          <div className="flex items-center gap-1.5">
            <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-100 ${speedTrackColor}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-xs text-gray-500">{SPEED_MIN}</span>
            <span className="text-xs text-gray-500">–</span>
            <span className="text-xs text-gray-500">{SPEED_MAX}</span>
          </div>
        </div>
      </SettingsRow>

      <SettingsRow icon="🎨" label="Background">
        <ColorInput hex={config.backgroundColor} onChange={v => update('backgroundColor', v)} />
      </SettingsRow>

      <SettingsRow icon="🌿" label="Ground">
        <ColorInput hex={config.groundColor} onChange={v => update('groundColor', v)} />
      </SettingsRow>
    </div>
  )
}

export default function Home() {
  const [prompt, setPrompt] = useState('')
  const [state, setState] = useState<AppState>('idle')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [error, setError] = useState<string | null>(null)
  const [voiceSupported, setVoiceSupported] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [currentConfig, setCurrentConfig] = useState<GameConfig | null>(null)
  const [activeTab, setActiveTab] = useState<ActiveTab>('chat')

  const iframeRef = useRef<HTMLIFrameElement>(null)
  const recognitionRef = useRef<any>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const isIterating = currentConfig !== null

  useEffect(() => {
    const hasSpeech = 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window
    setVoiceSupported(hasSpeech)
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendConfigToGame = useCallback((config: GameConfig) => {
    const iframe = iframeRef.current
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage({ type: 'LOAD_CONFIG', config }, '*')
    }
  }, [])

  const handleConfigChange = useCallback((config: GameConfig) => {
    setCurrentConfig(config)
    sendConfigToGame(config)
  }, [sendConfigToGame])

  const handleGenerate = useCallback(async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return

    setError(null)
    setState('thinking')
    setPrompt('')
    setActiveTab('chat') // always switch to chat tab while building

    const userMessage: ChatMessage = { role: 'user', content: trimmed }
    setMessages(prev => [...prev, userMessage])

    try {
      const response = await fetch('/api/generate-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: trimmed,
          currentConfig: currentConfig ?? undefined,
        }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Something went wrong')

      const config: GameConfig = data.config
      const isUpdate = currentConfig !== null

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: isUpdate
          ? `Updated! ${config.heroEmoji} now dodges ${config.enemyEmoji} at speed ${config.speed}. Keep going! 🎮`
          : `I made "${config.title}" for you! ${config.heroEmoji} dodges ${config.enemyEmoji}. Press SPACE or tap to jump!`,
      }
      setMessages(prev => [...prev, assistantMessage])

      setCurrentConfig(config)
      sendConfigToGame(config)
      setState('playing')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to make the game'
      setError(msg)
      setState(currentConfig ? 'playing' : 'idle')
    }
  }, [sendConfigToGame, currentConfig])

  const handleSubmit = () => {
    if (prompt.trim() && state !== 'thinking') handleGenerate(prompt)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const startListening = () => {
    if (!voiceSupported) return
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onstart = () => { setState('listening'); setTranscript('') }
    recognition.onerror = () => { setState(currentConfig ? 'playing' : 'idle') }

    recognitionRef.current = recognition
    recognitionRef.current.lastTranscript = ''

    recognition.onresult = (e: any) => {
      const result = Array.from(e.results).map((r: any) => r[0].transcript).join('')
      setTranscript(result)
      setPrompt(result)
      recognitionRef.current.lastTranscript = result
    }

    recognition.onend = () => {
      if (state === 'listening') setState(currentConfig ? 'playing' : 'idle')
      const finalTranscript = recognitionRef.current?.lastTranscript
      if (finalTranscript?.trim()) handleGenerate(finalTranscript)
    }

    recognition.start()
  }

  const stopListening = () => recognitionRef.current?.stop()

  return (
    <div className="flex h-screen bg-gray-900 overflow-hidden">
      {/* Left Rail */}
      <div className="w-80 bg-gray-800 flex flex-col border-r border-gray-700">

        {/* Header */}
        <div className="p-4 pb-0 border-b border-gray-700">
          <div className="flex items-center gap-3 mb-3">
            <div className="text-2xl">🎮</div>
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">Game Maker</h1>
              <p className="text-xs text-gray-400">
                {isIterating ? `Playing: ${currentConfig.title}` : 'Describe your game and play it!'}
              </p>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium border-b-2 transition-colors ${
                activeTab === 'chat'
                  ? 'border-green-500 text-green-400'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              <MessageSquare size={13} />
              Chat
            </button>
            <button
              onClick={() => setActiveTab('settings')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium border-b-2 transition-colors ${
                activeTab === 'settings'
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              }`}
            >
              <Settings size={13} />
              Settings
              {currentConfig && (
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              )}
            </button>
          </div>
        </div>

        {/* Tab content */}
        {activeTab === 'settings' ? (
          <SettingsPanel config={currentConfig} onConfigChange={handleConfigChange} />
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-gray-500 text-sm mt-8 px-4">
                <div className="text-4xl mb-3">✨</div>
                <p>Tell me about your game!</p>
                <p className="text-xs mt-2 text-gray-600">Try: "a dog jumping over cats" or "a rocket dodging asteroids"</p>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-green-600 text-white rounded-br-md'
                    : 'bg-gray-700 text-gray-100 rounded-bl-md'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}

            {state === 'thinking' && (
              <div className="flex justify-start">
                <div className="bg-gray-700 text-gray-100 rounded-2xl rounded-bl-md px-4 py-3 text-sm">
                  <span className="inline-flex gap-1">
                    <span className="animate-bounce" style={{ animationDelay: '0ms' }}>🎮</span>
                    <span className="animate-bounce" style={{ animationDelay: '150ms' }}>✨</span>
                    <span className="animate-bounce" style={{ animationDelay: '300ms' }}>🎮</span>
                  </span>
                  <span className="ml-2 text-gray-400">
                    {isIterating ? 'Updating your game...' : 'Building your game...'}
                  </span>
                </div>
              </div>
            )}

            {error && (
              <div className="bg-red-900/50 border border-red-700 rounded-xl p-3 text-xs text-red-300">
                {error}
              </div>
            )}

            <div ref={chatEndRef} />
          </div>
        )}

        {/* Input Area — always visible */}
        <div className="p-4 border-t border-gray-700 space-y-3">
          {state === 'listening' && transcript && (
            <div className="text-xs text-green-400 bg-green-900/30 rounded-lg px-3 py-2">
              🎤 "{transcript}"
            </div>
          )}

          {isIterating && state !== 'thinking' && (
            <div className="flex flex-wrap gap-1.5">
              {['Make it faster', 'Make it harder', 'Change the hero'].map(hint => (
                <button
                  key={hint}
                  onClick={() => handleGenerate(hint)}
                  className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-2.5 py-1 rounded-full transition-colors"
                >
                  {hint}
                </button>
              ))}
            </div>
          )}

          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isIterating ? 'What would you like to change?' : 'Describe your game...'}
            disabled={state === 'thinking' || state === 'listening'}
            className="w-full bg-gray-700 text-white placeholder-gray-500 rounded-xl px-3 py-2 text-sm resize-none border border-gray-600 focus:outline-none focus:border-green-500 transition-colors min-h-[56px]"
            rows={2}
          />

          <div className="flex gap-2">
            {voiceSupported && (
              <button
                onClick={state === 'listening' ? stopListening : startListening}
                disabled={state === 'thinking'}
                className={`flex-none w-11 h-11 rounded-xl flex items-center justify-center transition-all ${
                  state === 'listening'
                    ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                }`}
                title={state === 'listening' ? 'Stop recording' : 'Speak your idea'}
              >
                {state === 'listening' ? <MicOff size={18} className="text-white" /> : <Mic size={18} />}
              </button>
            )}

            <button
              onClick={handleSubmit}
              disabled={!prompt.trim() || state === 'thinking' || state === 'listening'}
              className={`flex-1 h-11 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                state === 'thinking'
                  ? 'bg-purple-800 text-purple-300 cursor-not-allowed'
                  : prompt.trim()
                  ? isIterating
                    ? 'bg-blue-500 hover:bg-blue-400 text-white shadow-lg shadow-blue-900/50'
                    : 'bg-green-500 hover:bg-green-400 text-white shadow-lg shadow-green-900/50'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              {state === 'thinking' ? (
                <><Sparkles size={15} className="animate-spin" />{isIterating ? 'Updating...' : 'Making...'}</>
              ) : isIterating ? (
                <><RefreshCw size={15} />Update Game!</>
              ) : (
                <><Gamepad2 size={15} />Make My Game!</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Right Rail */}
      <div className="flex-1 relative bg-gray-900">
        <iframe
          ref={iframeRef}
          src="/game.html"
          id="game-frame"
          className="w-full h-full border-0"
          title="Game Preview"
          sandbox="allow-scripts allow-same-origin"
        />
        {state === 'playing' && (
          <div className="absolute top-4 right-4 bg-green-600/90 backdrop-blur text-white text-xs px-3 py-1.5 rounded-full font-medium">
            🎮 Playing!
          </div>
        )}
      </div>
    </div>
  )
}
