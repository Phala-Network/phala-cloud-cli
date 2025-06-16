const context = {
  apiKey: null as string | null,
};

export function setApiKey(apiKey: string): void {
  context.apiKey = apiKey;
}

export function getApiKeyFromContext(): string | null {
  return context.apiKey;
}
