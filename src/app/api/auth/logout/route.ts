import { apiFailure, apiOk } from "@/lib/api";
import { destroySession } from "@/lib/session";

export async function POST() {
  try {
    await destroySession();
    return apiOk();
  } catch (error) {
    return apiFailure("api/auth/logout", error);
  }
}
