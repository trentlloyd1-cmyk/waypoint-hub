import "server-only";
import { z } from "zod";

/** Server-only secrets. Importing this from a browser component is a build error. */
const serverSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(20, "SUPABASE_SECRET_KEY is missing"),
  // Development-only shortcut to sign in as a seeded test user. Never set in production.
  ENABLE_DEV_LOGIN: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true" && process.env.NODE_ENV !== "production"),
});

let cached: z.infer<typeof serverSchema> | undefined;

export function serverEnv() {
  cached ??= serverSchema.parse({
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    ENABLE_DEV_LOGIN: process.env.ENABLE_DEV_LOGIN || undefined,
  });
  return cached;
}
