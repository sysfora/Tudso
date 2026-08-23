import { describe, expect, it } from 'vitest'
import { normalizeResumeExtraction } from './resume-extract.js'

describe('normalizeResumeExtraction', () => {
  it('keeps real skills, joins System Design, and puts Roboticela in projects', () => {
    const result = normalizeResumeExtraction({
      skills: [
        'Core',
        'TypeScript',
        'React',
        'System',
        'Design',
        'System Design',
        'RBAC',
        'OpenAPI',
        '-- 1 of 3 --',
        'SELECTED PROJECTS',
        'Roboticela',
        'Also',
        'Prisma',
      ],
      projects: [{ name: 'Roboticela', description: 'Desktop robotics app', technologies: ['Tauri', 'Rust'] }],
      memories: ['Built Roboticela with Tauri and Rust.'],
    })
    expect(result.parsed.skills).toEqual(expect.arrayContaining(['TypeScript', 'React', 'System Design', 'RBAC', 'OpenAPI', 'Prisma']))
    expect(result.parsed.skills).not.toContain('Roboticela')
    expect(result.parsed.skills).not.toContain('Core')
    expect(result.parsed.skills).not.toContain('Also')
    expect(result.parsed.skills).not.toContain('SELECTED PROJECTS')
    expect(result.parsed.skills).not.toContain('-- 1 of 3 --')
    expect(result.parsed.skills).not.toContain('System')
    expect(result.parsed.skills).not.toContain('Design')
    expect(result.parsed.projects[0]?.name).toBe('Roboticela')
    expect(result.memories[0]).toContain('Roboticela')
  })
})
