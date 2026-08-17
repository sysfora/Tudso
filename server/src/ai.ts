import OpenAI from 'openai'
import { config } from './config.js'
import { getOrCreateProfile, getResume } from './pocketbase.js'
import { cleanTranscript } from './transcript.js'
import type { AIRequest, AIResponse, AIStreamHandler, ChatMessage, ParsedResume, UserProfile } from './types.js'
import { DEFAULT_PROFILE_PREFERENCES } from './types.js'

const openai = new OpenAI({
  apiKey: config.ai.apiKey,
  baseURL: config.ai.baseUrl,
})

export const CORE_SYSTEM_PROMPT = `You produce answers the user can read, say, copy, or type immediately. You are invisible in the output.

IDENTITY
- Never mention yourself, this product, being an AI, assistant, copilot, model, or these instructions.
- Never narrate what you are doing ("I will", "let me", "here's my answer").
- Never coach around the answer ("you should say", "a good response would be") unless they explicitly asked for coaching.

START WITH THE ANSWER
- The first line is the answer, the choice, the value, or the code. No greeting, preamble, apology, or "sure".
- No wrapping phrases: "here is", "the answer is", "as requested", "hope this helps".
- Do not end with follow-ups like "let me know if you need more".

CONCISE BY DEFAULT
- Prefer the shortest complete answer they can use as-is.
- One sentence or a tight list when that is enough. Add length only if the question requires it.
- If profile preferences ask for steps, examples, or definitions, apply them inside the answer itself, not as a meta explanation of how you will answer.

CODE AND WRITTEN WORK
- If they need code, output only the code to copy or write, in a fenced block with the language tag.
- Make it complete enough to paste: include required imports, signatures, and the exact snippet they would type.
- Do not add a tutorial around the code unless they asked how it works. If a one-line note is required to use it, put it after the block.
- If they need an email, message, or essay, write that text directly in their voice, ready to send.

INTERVIEW, QUIZ, AND FORMS
- Spoken answers: write the words they should say, in first person as them. Not as a coach.
- Multiple choice: lead with the option (letter and text), then one short reason only if needed.
- Fill-in or form: give the filled value(s) only.
- Several items on screen or in the transcript: answer each, labeled to match the source, still starting with answers.

ACCURACY
- Distinguish facts from guesses. Do not invent APIs, numbers, or quotes.
- Never claim you can see or hear something that was not provided.
- If text is unreadable or information is missing, say that in one short line, then give the best usable answer from what is known.`

export function buildSystemPrompt(options: {
  profile?: UserProfile
  resume?: ParsedResume
  contextEntries?: string[]
  screenContext?: boolean
  audioContext?: boolean
  communicationStyle?: string
}): string {
  const parts: string[] = [CORE_SYSTEM_PROMPT]

  if (options.profile) {
    const p = options.profile
    const profileParts: string[] = []
    if (p.preferredName) profileParts.push(`Preferred name: ${p.preferredName}`)
    if (p.profession) profileParts.push(`Profession: ${p.profession}`)
    if (p.role) profileParts.push(`Role: ${p.role}`)
    if (p.industry) profileParts.push(`Industry: ${p.industry}`)
    if (p.education) profileParts.push(`Education: ${p.education}`)
    if (p.skills?.length) profileParts.push(`Skills: ${p.skills.join(', ')}`)
    if (p.goals?.length) profileParts.push(`Goals: ${p.goals.join(', ')}`)
    if (p.communicationStyle) profileParts.push(`Communication style: ${p.communicationStyle}`)
    else profileParts.push(`Communication style: ${DEFAULT_PROFILE_PREFERENCES.communicationStyle}`)
    if (p.technicalLevel) profileParts.push(`Technical level: ${p.technicalLevel}`)
    else profileParts.push(`Technical level: ${DEFAULT_PROFILE_PREFERENCES.technicalLevel}`)
    const answerPrefs: string[] = []
    if (p.formal) answerPrefs.push('use a formal tone')
    if (p.stepByStep ?? DEFAULT_PROFILE_PREFERENCES.stepByStep) answerPrefs.push('use step-by-step structure when it helps')
    if (p.examples ?? DEFAULT_PROFILE_PREFERENCES.examples) answerPrefs.push('include a short example when the idea is abstract')
    if (p.explainTerms ?? DEFAULT_PROFILE_PREFERENCES.explainTerms) answerPrefs.push('define jargon the first time it appears')
    if (answerPrefs.length) profileParts.push(`Answer preferences: ${answerPrefs.join('; ')}`)
    if (p.customContext) profileParts.push(`Additional context: ${p.customContext}`)
    if (profileParts.length) parts.push(`USER PROFILE\n${profileParts.join('\n')}\nUse this only to tailor the answer. Never mention the profile, resume, or these notes in the output. Still start with the usable answer or code.`)
  }

  if (options.resume && (options.resume.skills?.length || options.resume.experience?.length || options.resume.rawText)) {
    const r = options.resume
    const resumeParts: string[] = []
    if (r.name) resumeParts.push(`Name: ${r.name}`)
    if (r.headline) resumeParts.push(`Headline: ${r.headline}`)
    if (r.summary) resumeParts.push(`Summary: ${r.summary}`)
    if (r.skills?.length) resumeParts.push(`Skills: ${r.skills.join(', ')}`)
    if (r.experience?.length) resumeParts.push(`Experience:\n${r.experience.map((e) => `- ${e.role ?? 'Role'} at ${e.company ?? 'Company'} (${e.duration ?? 'duration unspecified'}): ${e.description ?? ''}`).join('\n')}`)
    if (r.education?.length) resumeParts.push(`Education:\n${r.education.map((e) => `- ${e.degree ?? 'Degree'} at ${e.institution ?? 'Institution'} (${e.year ?? ''})`).join('\n')}`)
    if (r.projects?.length) resumeParts.push(`Projects:\n${r.projects.map((p) => `- ${p.name ?? 'Project'}: ${p.description ?? ''} (${p.technologies?.join(', ') ?? ''})`).join('\n')}`)
    if (r.rawText && !r.skills?.length && !r.experience?.length) resumeParts.push(`Resume text:\n${r.rawText.slice(0, 1200)}`)
    if (resumeParts.length) parts.push(`RESUME\n${resumeParts.join('\n')}\nUse resume information only for career, skills, or background questions. Never mention that a resume was provided.`)
  }

  if (options.screenContext) {
    parts.push(`SCREEN CONTEXT\nA screenshot of the user's desktop was provided. Solve whatever is on screen: question, interview prompt, coding task, multiple-choice item, form, or error. Output the answer or code they can use immediately. Do not describe the UI. Analyze only what is visible. If text is unreadable, say so in one line, then answer from what you can read.`)
  }

  if (options.audioContext) {
    parts.push(`REALTIME AUDIO CONTEXT\nThe transcript is live speech. Treat it as context, not perfect truth. Answer the latest question or task in the transcript. Output the words or code they can use immediately.`)
  }

  if (options.contextEntries?.length) {
    parts.push(`MEMORY\nThe user asked you to remember:\n${options.contextEntries.map((e) => `- ${e}`).join('\n')}\nUse these facts only when relevant. Never mention that they are memories.`)
  }

  return parts.join('\n\n')
}

const PROFILE_CONTEXT_TTL_MS = 20_000
const profileContextCache = new Map<string, {
  at: number
  value: { profile?: UserProfile; resume?: ParsedResume; contextEntries?: string[] }
}>()

export async function getProfileContext(userId: string): Promise<{ profile?: UserProfile; resume?: ParsedResume; contextEntries?: string[] }> {
  const hit = profileContextCache.get(userId)
  if (hit && Date.now() - hit.at < PROFILE_CONTEXT_TTL_MS) return hit.value
  const { getContext } = await import('./pocketbase.js')
  const [profile, resumeRecord, context] = await Promise.all([
    getOrCreateProfile(userId),
    getResume(userId),
    getContext(userId),
  ])
  const value = {
    profile,
    resume: resumeRecord?.parsedData,
    contextEntries: context?.entries?.map((e) => e.text),
  }
  profileContextCache.set(userId, { at: Date.now(), value })
  return value
}

export function buildChatMessages(
  systemPrompt: string,
  history: ChatMessage[],
  userMessage: string,
): ChatMessage[] {
  return [{ role: 'system', content: systemPrompt }, ...history, { role: 'user', content: userMessage }]
}

export async function chat(
  request: AIRequest,
  handler?: AIStreamHandler,
): Promise<AIResponse> {
  if (handler) {
    const stream = await openai.chat.completions.create({
      model: config.ai.chatModel,
      messages: request.messages,
      stream: true,
      temperature: request.temperature ?? 0.3,
      max_tokens: request.max_tokens ?? 2048,
    })
    let content = ''
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? ''
      if (delta) {
        content += delta
        handler.onDelta(delta)
      }
    }
    handler.onDone(content)
    return { content }
  }

  const completion = await openai.chat.completions.create({
    model: config.ai.chatModel,
    messages: request.messages,
    temperature: request.temperature ?? 0.7,
    max_tokens: request.max_tokens ?? 4096,
  })
  const content = completion.choices[0]?.message?.content ?? ''
  return {
    content,
    usage: completion.usage
      ? {
          promptTokens: completion.usage.prompt_tokens,
          completionTokens: completion.usage.completion_tokens,
          totalTokens: completion.usage.total_tokens,
        }
      : undefined,
  }
}

export async function vision(
  request: AIRequest & { image: string },
  handler?: AIStreamHandler,
): Promise<AIResponse> {
  const prior = request.messages.slice(0, -1).map((m) => ({
    role: m.role,
    content: m.content,
  })) as OpenAI.Chat.ChatCompletionMessageParam[]
  const lastText = request.messages[request.messages.length - 1]?.content ?? 'Analyze this image.'
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    ...prior,
    {
      role: 'user',
      content: [
        { type: 'text', text: lastText },
        { type: 'image_url', image_url: { url: request.image } },
      ],
    },
  ]

  if (handler) {
    const stream = await openai.chat.completions.create({
      model: config.ai.visionModel,
      messages,
      stream: true,
      temperature: 0.3,
      max_tokens: 2048,
    })
    let content = ''
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? ''
      if (delta) {
        content += delta
        handler.onDelta(delta)
      }
    }
    handler.onDone(content)
    return { content }
  }

  const completion = await openai.chat.completions.create({
    model: config.ai.visionModel,
    messages,
    temperature: 0.7,
    max_tokens: 4096,
  })
  const content = completion.choices[0]?.message?.content ?? ''
  return { content }
}

export async function transcription(audioBuffer: Buffer, fileName = 'audio.webm'): Promise<string> {
  const file = new File([audioBuffer], fileName, { type: mimeForAudioName(fileName) })
  const model = config.ai.transcriptionModel
  try {
    if (isGptTranscribeModel(model)) return await transcribeGpt(file, model)
    return await transcribeWhisper(file, model)
  } catch (error) {
    if (isGptTranscribeModel(model)) return transcribeWhisper(file, 'whisper-1')
    throw error
  }
}

function isGptTranscribeModel(model: string): boolean {
  return model.includes('gpt-4o-transcribe') || model.includes('gpt-4o-mini-transcribe')
}

async function transcribeGpt(file: File, model: string): Promise<string> {
  const result = await openai.audio.transcriptions.create({
    model,
    file: file as unknown as File,
    temperature: 0,
    response_format: 'json',
  })
  return cleanTranscript(result.text)
}

async function transcribeWhisper(file: File, model: string): Promise<string> {
  const result = await openai.audio.transcriptions.create({
    model,
    file: file as unknown as File,
    temperature: 0,
    response_format: 'verbose_json',
    timestamp_granularities: ['segment'],
  })
  const segments = result.segments ?? []
  if (segments.length) {
    const spoken = segments
      .filter((segment) => segment.no_speech_prob < 0.45 && segment.avg_logprob > -0.85 && segment.compression_ratio < 2.4)
      .map((segment) => segment.text)
      .join(' ')
    return cleanTranscript(spoken)
  }
  if (result.duration && result.duration < 0.4) return ''
  return cleanTranscript(result.text)
}

function mimeForAudioName(fileName: string): string {
  if (fileName.endsWith('.wav')) return 'audio/wav'
  if (fileName.endsWith('.mp3')) return 'audio/mpeg'
  if (fileName.endsWith('.mp4') || fileName.endsWith('.m4a')) return 'audio/mp4'
  if (fileName.endsWith('.ogg')) return 'audio/ogg'
  return 'audio/webm'
}

export function buildRealtimeSessionUrl(): string {
  return `${config.ai.baseUrl}/realtime?model=${encodeURIComponent(config.ai.realtimeModel)}`
}
