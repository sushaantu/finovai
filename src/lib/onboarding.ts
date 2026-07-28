const INCOME_PROMPT_DISMISS_PREFIX = 'finovai_income_prompt_dismissed:'

function incomePromptStorageKey(email: string) {
  return `${INCOME_PROMPT_DISMISS_PREFIX}${email.trim().toLowerCase()}`
}

export function isIncomePromptDismissed(email: string): boolean {
  if (typeof window === 'undefined' || !email.trim()) return false
  return window.localStorage.getItem(incomePromptStorageKey(email)) === '1'
}

export function dismissIncomePrompt(email: string): void {
  if (typeof window === 'undefined' || !email.trim()) return
  window.localStorage.setItem(incomePromptStorageKey(email), '1')
}
