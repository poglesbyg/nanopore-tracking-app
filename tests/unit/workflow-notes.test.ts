import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock the enhanced notes functionality
interface NoteMention {
  member: string
  position: number
}

class WorkflowNotesManager {
  private static readonly TEAM_MEMBERS = [
    'Grey', 'Stephanie', 'Jenny', 'Alex', 'Morgan'
  ]

  static formatNotesWithMentions(text: string): Array<{ type: 'text' | 'mention', content: string }> {
    if (!text) return []
    
    // Split text by @mentions and format them
    const parts = text.split(/(@\w+)/g)
    return parts
      .filter(part => part.length > 0)
      .map(part => {
        if (part.startsWith('@')) {
          return { type: 'mention' as const, content: part }
        }
        return { type: 'text' as const, content: part }
      })
  }

  static extractMentions(text: string): string[] {
    const mentionRegex = /@(\w+)/g
    const mentions: string[] = []
    let match

    while ((match = mentionRegex.exec(text)) !== null) {
      const member = match[1]
      if (this.TEAM_MEMBERS.includes(member)) {
        mentions.push(member)
      }
    }

    return [...new Set(mentions)] // Remove duplicates
  }

  static validateMentions(text: string): { valid: string[], invalid: string[] } {
    const allMentions = text.match(/@(\w+)/g) || []
    const valid: string[] = []
    const invalid: string[] = []

    allMentions.forEach(mention => {
      const member = mention.slice(1) // Remove @ symbol
      if (this.TEAM_MEMBERS.includes(member)) {
        if (!valid.includes(member)) {
          valid.push(member)
        }
      } else {
        if (!invalid.includes(mention)) {
          invalid.push(mention)
        }
      }
    })

    return { valid, invalid }
  }

  static insertMention(text: string, cursorPosition: number, member: string): { text: string, newCursorPosition: number } {
    const mention = `@${member} `
    const beforeCursor = text.slice(0, cursorPosition)
    const afterCursor = text.slice(cursorPosition)
    
    const newText = beforeCursor + mention + afterCursor
    const newCursorPosition = cursorPosition + mention.length

    return { text: newText, newCursorPosition }
  }

  static getCompletionTemplates(): Array<{ label: string, content: string, icon: string }> {
    return [
      {
        label: 'Success - No Issues',
        content: '✅ Completed successfully with no issues.',
        icon: '✅'
      },
      {
        label: 'Success - Minor Issues',
        content: '⚠️ Completed with minor issues. See notes below.',
        icon: '⚠️'
      },
      {
        label: 'QC Passed',
        content: '📋 QC passed. Ready for next step.',
        icon: '📋'
      },
      {
        label: 'Needs Follow-up',
        content: '🔄 Requires follow-up: ',
        icon: '🔄'
      },
      {
        label: 'Custom Template',
        content: '📝 Custom completion notes: ',
        icon: '📝'
      }
    ]
  }

  static truncateNotes(text: string, maxLength: number = 500): { text: string, truncated: boolean } {
    if (text.length <= maxLength) {
      return { text, truncated: false }
    }

    return { 
      text: text.slice(0, maxLength), 
      truncated: true 
    }
  }

  static formatNotesForDisplay(text: string, maxLength: number = 200): string {
    if (!text) return 'No notes added yet.'
    
    const { text: truncatedText, truncated } = this.truncateNotes(text, maxLength)
    return truncated ? `${truncatedText}...` : truncatedText
  }
}

describe('Workflow Notes Enhancement Tests', () => {
  describe('formatNotesWithMentions', () => {
    it('should format text with mentions correctly', () => {
      const text = 'Hello @Grey, please review this with @Stephanie'
      const result = WorkflowNotesManager.formatNotesWithMentions(text)

      expect(result).toEqual([
        { type: 'text', content: 'Hello ' },
        { type: 'mention', content: '@Grey' },
        { type: 'text', content: ', please review this with ' },
        { type: 'mention', content: '@Stephanie' }
      ])
    })

    it('should handle text without mentions', () => {
      const text = 'This is a normal note without mentions'
      const result = WorkflowNotesManager.formatNotesWithMentions(text)

      expect(result).toEqual([
        { type: 'text', content: 'This is a normal note without mentions' }
      ])
    })

    it('should handle empty text', () => {
      const result = WorkflowNotesManager.formatNotesWithMentions('')
      expect(result).toEqual([])
    })

    it('should handle text with only mentions', () => {
      const text = '@Grey @Stephanie @Jenny'
      const result = WorkflowNotesManager.formatNotesWithMentions(text)

      expect(result).toEqual([
        { type: 'mention', content: '@Grey' },
        { type: 'text', content: ' ' },
        { type: 'mention', content: '@Stephanie' },
        { type: 'text', content: ' ' },
        { type: 'mention', content: '@Jenny' }
      ])
    })
  })

  describe('extractMentions', () => {
    it('should extract valid team member mentions', () => {
      const text = 'Hey @Grey and @Stephanie, can you help @Alex?'
      const mentions = WorkflowNotesManager.extractMentions(text)

      expect(mentions).toEqual(['Grey', 'Stephanie', 'Alex'])
    })

    it('should ignore invalid mentions', () => {
      const text = 'Hey @Grey and @InvalidUser, also @Stephanie'
      const mentions = WorkflowNotesManager.extractMentions(text)

      expect(mentions).toEqual(['Grey', 'Stephanie'])
    })

    it('should remove duplicate mentions', () => {
      const text = 'Hey @Grey, talk to @Grey again about @Grey'
      const mentions = WorkflowNotesManager.extractMentions(text)

      expect(mentions).toEqual(['Grey'])
    })

    it('should return empty array for no mentions', () => {
      const text = 'No mentions in this text'
      const mentions = WorkflowNotesManager.extractMentions(text)

      expect(mentions).toEqual([])
    })
  })

  describe('validateMentions', () => {
    it('should separate valid and invalid mentions', () => {
      const text = '@Grey is working with @InvalidUser and @Stephanie on @NonExistent project'
      const result = WorkflowNotesManager.validateMentions(text)

      expect(result).toEqual({
        valid: ['Grey', 'Stephanie'],
        invalid: ['@InvalidUser', '@NonExistent']
      })
    })

    it('should handle all valid mentions', () => {
      const text = '@Grey @Stephanie @Jenny @Alex @Morgan'
      const result = WorkflowNotesManager.validateMentions(text)

      expect(result).toEqual({
        valid: ['Grey', 'Stephanie', 'Jenny', 'Alex', 'Morgan'],
        invalid: []
      })
    })

    it('should handle no mentions', () => {
      const text = 'No mentions here'
      const result = WorkflowNotesManager.validateMentions(text)

      expect(result).toEqual({
        valid: [],
        invalid: []
      })
    })
  })

  describe('insertMention', () => {
    it('should insert mention at cursor position', () => {
      const text = 'Hello , please review'
      const cursorPosition = 6 // After "Hello "
      const result = WorkflowNotesManager.insertMention(text, cursorPosition, 'Grey')

      expect(result).toEqual({
        text: 'Hello @Grey , please review',
        newCursorPosition: 12 // After "@Grey "
      })
    })

    it('should insert mention at beginning', () => {
      const text = 'please review this'
      const result = WorkflowNotesManager.insertMention(text, 0, 'Stephanie')

      expect(result).toEqual({
        text: '@Stephanie please review this',
        newCursorPosition: 11
      })
    })

    it('should insert mention at end', () => {
      const text = 'Please check with '
      const result = WorkflowNotesManager.insertMention(text, text.length, 'Jenny')

      expect(result).toEqual({
        text: 'Please check with @Jenny ',
        newCursorPosition: 25
      })
    })
  })

  describe('getCompletionTemplates', () => {
    it('should return predefined completion templates', () => {
      const templates = WorkflowNotesManager.getCompletionTemplates()

      expect(templates).toHaveLength(5)
      expect(templates[0]).toEqual({
        label: 'Success - No Issues',
        content: '✅ Completed successfully with no issues.',
        icon: '✅'
      })
      expect(templates[1]).toEqual({
        label: 'Success - Minor Issues',
        content: '⚠️ Completed with minor issues. See notes below.',
        icon: '⚠️'
      })
    })

    it('should have consistent template structure', () => {
      const templates = WorkflowNotesManager.getCompletionTemplates()

      templates.forEach(template => {
        expect(template).toHaveProperty('label')
        expect(template).toHaveProperty('content')
        expect(template).toHaveProperty('icon')
        expect(typeof template.label).toBe('string')
        expect(typeof template.content).toBe('string')
        expect(typeof template.icon).toBe('string')
      })
    })
  })

  describe('truncateNotes', () => {
    it('should truncate text longer than max length', () => {
      const longText = 'A'.repeat(600)
      const result = WorkflowNotesManager.truncateNotes(longText, 500)

      expect(result).toEqual({
        text: 'A'.repeat(500),
        truncated: true
      })
    })

    it('should not truncate text within max length', () => {
      const shortText = 'This is a short note'
      const result = WorkflowNotesManager.truncateNotes(shortText, 500)

      expect(result).toEqual({
        text: shortText,
        truncated: false
      })
    })

    it('should handle exactly max length', () => {
      const exactText = 'A'.repeat(100)
      const result = WorkflowNotesManager.truncateNotes(exactText, 100)

      expect(result).toEqual({
        text: exactText,
        truncated: false
      })
    })

    it('should use default max length of 500', () => {
      const longText = 'A'.repeat(600)
      const result = WorkflowNotesManager.truncateNotes(longText)

      expect(result.text.length).toBe(500)
      expect(result.truncated).toBe(true)
    })
  })

  describe('formatNotesForDisplay', () => {
    it('should format short notes normally', () => {
      const text = 'Short note'
      const result = WorkflowNotesManager.formatNotesForDisplay(text)

      expect(result).toBe('Short note')
    })

    it('should add ellipsis for long notes', () => {
      const longText = 'A'.repeat(250)
      const result = WorkflowNotesManager.formatNotesForDisplay(longText, 200)

      expect(result).toBe('A'.repeat(200) + '...')
    })

    it('should handle empty notes', () => {
      const result = WorkflowNotesManager.formatNotesForDisplay('')

      expect(result).toBe('No notes added yet.')
    })

    it('should use default max length of 200', () => {
      const longText = 'A'.repeat(250)
      const result = WorkflowNotesManager.formatNotesForDisplay(longText)

      expect(result).toBe('A'.repeat(200) + '...')
    })
  })

  describe('Edge Cases', () => {
    it('should handle malformed mentions gracefully', () => {
      const text = '@ @a @Grey@ @123 @Grey_test @'
      const mentions = WorkflowNotesManager.extractMentions(text)

      expect(mentions).toEqual(['Grey'])
    })

    it('should handle unicode characters in notes', () => {
      const text = '🚀 Great work @Grey! 👏 @Stephanie did amazing work 🎉'
      const formatted = WorkflowNotesManager.formatNotesWithMentions(text)

      expect(formatted).toContainEqual({ type: 'text', content: '🚀 Great work ' })
      expect(formatted).toContainEqual({ type: 'mention', content: '@Grey' })
      expect(formatted).toContainEqual({ type: 'text', content: '! 👏 ' })
    })

    it('should handle very long mentions', () => {
      const text = '@VeryLongUsernameThatsNotInTeam @Grey'
      const validation = WorkflowNotesManager.validateMentions(text)

      expect(validation.valid).toEqual(['Grey'])
      expect(validation.invalid).toEqual(['@VeryLongUsernameThatsNotInTeam'])
    })
  })
}) 