import { ZodTypeAny, infer as zInfer } from 'zod';

export const parseWithZod = <TSchema extends ZodTypeAny>(schema: TSchema, data: unknown): zInfer<TSchema> => {
  const result = schema.safeParse(data);
  if (!result.success) {
    const message = result.error.issues[0]?.message || 'Invalid request payload';
    const error = new Error(message);
    (error as { status?: number }).status = 400;
    throw error;
  }
  return result.data;
};
