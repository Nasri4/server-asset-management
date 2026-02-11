import { z } from "zod";

export function requiredText(message: string) {
  return z.string().trim().min(1, message);
}

/**
 * Treats empty/whitespace-only strings as "not provided".
 * Useful for optional text fields so submitting "" doesn't hit the API.
 */
export function optionalText() {
  return z
    .string()
    .transform((value) => {
      const trimmed = value.trim();
      return trimmed.length ? trimmed : undefined;
    })
    .optional();
}
