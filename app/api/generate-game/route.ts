import { NextRequest, NextResponse } from 'next/server'
import { generateGameConfig, generateGameCode, isCloneRequest } from '@/lib/ai'
import { GameConfig } from '@/lib/types'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    // isCodeMode: explicit flag set by the "Build a Clone" UI toggle
    // codeAccumPrompt: accumulated description for iterating on code games
    const { prompt, currentConfig, isCodeMode, codeAccumPrompt, mobile } = body

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 })
    }

    const trimmed = prompt.trim()

    // Code generation path: explicit clone mode OR keyword-detected clone request
    const shouldGenerateCode = isCodeMode === true || isCloneRequest(trimmed)

    if (shouldGenerateCode) {
      // For iterations on a code game, codeAccumPrompt holds the full accumulated description
      const codePrompt = (codeAccumPrompt as string | undefined)?.trim() || trimmed
      const result = await generateGameCode(codePrompt, mobile === true)
      return NextResponse.json(result)   // { type: 'code', title, code }
    }

    // Config path: runner or topdown template
    const config = await generateGameConfig(
      trimmed,
      currentConfig as GameConfig | undefined,
      mobile === true
    )
    return NextResponse.json({ type: 'config', config })

  } catch (error) {
    console.error('Generate game error:', error)
    return NextResponse.json(
      { error: 'Failed to generate game' },
      { status: 500 }
    )
  }
}
