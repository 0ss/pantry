import { z } from "zod";

/** Signup form payload. */
export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

export type SignupInput = z.infer<typeof signupSchema>;

/** Profile update payload. */
export const profileSchema = z.object({
  name: z.string().min(1),
  bio: z.string().max(280).optional(),
});
