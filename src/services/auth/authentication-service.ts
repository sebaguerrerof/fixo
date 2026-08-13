import {
  authSessionSchema,
  type AuthSession,
  type SignInInput,
} from "@/integrations/auth/auth-provider";
import { SampleAuthProvider } from "@/integrations/auth/sample-auth-provider";
import { usesSampleData } from "@/config/runtime";

const sessionStorageKey = "fixo.session";

function writeSession(session: AuthSession): void {
  window.localStorage.setItem(sessionStorageKey, JSON.stringify(session));
}

export class AuthenticationService {
  async signIn(input: SignInInput): Promise<AuthSession> {
    if (!usesSampleData()) {
      throw new Error("El acceso requiere configurar el proveedor de autenticación.");
    }

    const session = await new SampleAuthProvider().signIn(input);
    writeSession(session);
    return session;
  }

  getCurrentSession(): AuthSession | null {
    if (typeof window === "undefined") return null;

    const rawSession = window.localStorage.getItem(sessionStorageKey);
    if (!rawSession) return null;

    try {
      const parsed = authSessionSchema.safeParse(JSON.parse(rawSession));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  signOut(): void {
    if (typeof window !== "undefined") window.localStorage.removeItem(sessionStorageKey);
  }
}
