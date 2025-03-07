import { z } from 'zod';

// Docker Compose Template Schema
export const ComposeTemplateSchema = z.object({
  template: z.string().min(1, "Template cannot be empty")
});

export type ComposeTemplate = z.infer<typeof ComposeTemplateSchema>; 