export const queryKeys = {
  transactions: (email: string) => ['transactions', email] as const,
  syncfyCredentials: (email: string) => ['syncfyCredentials', email] as const,
  household: (email: string) => ['household', email] as const,
}
