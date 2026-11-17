import { z } from 'zod';
import { MaterialSchema } from './step-material';
export const InterviewQuestionSchema = z.object({
  id: z.string().min(1).max(200), stepId: z.string().max(128).optional(),
  target: z.enum(['intent', 'why', 'exceptions', 'supplement']),
  question: z.string().min(1).max(1500), answer: z.string().max(6000).default(''),
  reviewed: z.boolean().default(false), materials: z.array(MaterialSchema).max(20).optional(),
});
export type InterviewQuestion = z.infer<typeof InterviewQuestionSchema>;
