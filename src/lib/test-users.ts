import type { AppRole } from "@/lib/database.types";

/**
 * Fake staff accounts created by the seed script, one per role, for testing permissions.
 * The .test domain can never receive real email.
 */
export const TEST_USERS: { email: string; name: string; role: AppRole }[] = [
  { email: "admin@waypointhub.test", name: "Alex Admin", role: "admin" },
  { email: "manager@waypointhub.test", name: "Morgan Manager", role: "manager" },
  { email: "bizdev@waypointhub.test", name: "Blake Bizdev", role: "bizdev" },
  { email: "support@waypointhub.test", name: "Sam Support", role: "support" },
];
