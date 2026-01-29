// Journal Storage Abstraction Layer
// Supports localStorage (offline) and Supabase (when connected)
// TODO: Implement Supabase integration when database is connected

type StorageResult<T> = {
  success: boolean
  data?: T
  error?: string
  source: 'database' | 'localStorage'
}

type JournalEntry = {
  id?: string
  date: string // YYYY-MM-DD
  is_draft: boolean
  completed_at?: string
  created_at?: string
  updated_at?: string
}

type Answer = {
  question_key: string
  answer_value: any // JSONB-compatible value
  answer_type: 'text' | 'number' | 'rating' | 'boolean' | 'multiselect' | 'date'
}

type DraftData = {
  entry: JournalEntry
  answers: Answer[]
}

// Helper to format date as YYYY-MM-DD
function formatDate(date: Date | string): string {
  if (typeof date === 'string') return date
  return date.toISOString().split('T')[0]
}

// Helper to get localStorage key for a date
function getLocalStorageKey(date: string): string {
  return `journal_draft_${date}`
}

function getSubmittedKey(date: string): string {
  return `journal_submitted_${date}`
}

/**
 * Get draft entry for a specific date
 */
export async function getDraft(date: Date | string): Promise<StorageResult<DraftData | null>> {
  const dateStr = formatDate(date)

  // TODO: Try Supabase first when database is connected
  // try {
  //   const { data, error } = await supabase
  //     .from('journal_entries')
  //     .select('*, answers(*)')
  //     .eq('date', dateStr)
  //     .eq('is_draft', true)
  //     .single()
  //   
  //   if (!error && data) {
  //     return { success: true, data: transformFromDB(data), source: 'database' }
  //   }
  // } catch (error) {
  //   console.warn('Database fetch failed, falling back to localStorage:', error)
  // }

  // Fallback to localStorage
  try {
    const stored = localStorage.getItem(getLocalStorageKey(dateStr))
    if (stored) {
      const data = JSON.parse(stored)
      return { success: true, data, source: 'localStorage' }
    }
    return { success: true, data: null, source: 'localStorage' }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to load draft',
      source: 'localStorage',
    }
  }
}

/**
 * Save draft entry
 */
export async function saveDraft(date: Date | string, answers: Answer[]): Promise<StorageResult<DraftData>> {
  const dateStr = formatDate(date)

  const entry: JournalEntry = {
    date: dateStr,
    is_draft: true,
    updated_at: new Date().toISOString(),
  }

  const draftData: DraftData = {
    entry,
    answers,
  }

  // TODO: Save to Supabase when database is connected
  // try {
  //   const { data: entryData, error: entryError } = await supabase
  //     .from('journal_entries')
  //     .upsert({
  //       date: dateStr,
  //       is_draft: true,
  //       updated_at: new Date().toISOString(),
  //     }, { onConflict: 'date' })
  //     .select()
  //     .single()
  //
  //   if (entryError) throw entryError
  //
  //   // Save answers
  //   // ... implementation
  //
  //   return { success: true, data: draftData, source: 'database' }
  // } catch (error) {
  //   console.warn('Database save failed, falling back to localStorage:', error)
  // }

  // Fallback to localStorage
  try {
    localStorage.setItem(getLocalStorageKey(dateStr), JSON.stringify(draftData))
    return { success: true, data: draftData, source: 'localStorage' }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save draft',
      source: 'localStorage',
    }
  }
}

/**
 * Submit entry (mark as completed)
 */
export async function submitEntry(date: Date | string, answers: Answer[]): Promise<StorageResult<DraftData>> {
  const dateStr = formatDate(date)

  const entry: JournalEntry = {
    date: dateStr,
    is_draft: false,
    completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const entryData: DraftData = {
    entry,
    answers,
  }

  // TODO: Submit to Supabase when database is connected
  // try {
  //   const { data: entryData, error: entryError } = await supabase
  //     .from('journal_entries')
  //     .upsert({
  //       date: dateStr,
  //       is_draft: false,
  //       completed_at: new Date().toISOString(),
  //       updated_at: new Date().toISOString(),
  //     }, { onConflict: 'date' })
  //     .select()
  //     .single()
  //
  //   if (entryError) throw entryError
  //
  //   // Save answers
  //   // ... implementation
  //
  //   return { success: true, data: entryData, source: 'database' }
  // } catch (error) {
  //   console.warn('Database submit failed, falling back to localStorage:', error)
  // }

  // Fallback to localStorage
  try {
    // Remove draft if exists
    localStorage.removeItem(getLocalStorageKey(dateStr))
    
    // Save as submitted entry
    localStorage.setItem(getSubmittedKey(dateStr), JSON.stringify(entryData))
    return { success: true, data: entryData, source: 'localStorage' }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to submit entry',
      source: 'localStorage',
    }
  }
}

/**
 * Check if an entry exists for a date (draft or submitted)
 */
export async function entryExists(date: Date | string): Promise<StorageResult<{ exists: boolean; is_draft: boolean }>> {
  const dateStr = formatDate(date)

  // TODO: Check Supabase when database is connected

  // Check localStorage
  try {
    const draft = localStorage.getItem(getLocalStorageKey(dateStr))
    const submitted = localStorage.getItem(getSubmittedKey(dateStr))
    
    if (draft) {
      return { success: true, data: { exists: true, is_draft: true }, source: 'localStorage' }
    }
    if (submitted) {
      return { success: true, data: { exists: true, is_draft: false }, source: 'localStorage' }
    }
    return { success: true, data: { exists: false, is_draft: false }, source: 'localStorage' }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to check entry',
      source: 'localStorage',
    }
  }
}
