"use client";

import { ArrowLeft, LoaderCircle, Mail, PanelTop } from "lucide-react";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { CLOUD_ENABLED, getSupabase } from "@/lib/cloud/supabase";

interface CloudUser {
  id: string;
  email: string;
  signOut: () => Promise<void>;
}

type SessionState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "signed-in"; id: string; email: string };

const CloudUserContext = createContext<CloudUser | null>(null);

// The signed-in user, or null when decks are stored in the browser.
export function useCloudUser() {
  return useContext(CloudUserContext);
}

const signOut = async () => {
  await getSupabase().auth.signOut();
};

// With cloud storage configured, everything behind this gate needs an
// account. Without it the app works as before, with no sign-in.
export function AuthGate({ children }: { children: ReactNode }) {
  if (!CLOUD_ENABLED) return children;
  return <CloudAuthGate>{children}</CloudAuthGate>;
}

function CloudAuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionState>({ status: "loading" });

  useEffect(() => {
    const auth = getSupabase().auth;
    const apply = (user: { id: string; email?: string } | null | undefined) =>
      setSession(user ? { status: "signed-in", id: user.id, email: (user.email ?? "").toLowerCase() } : { status: "signed-out" });

    let active = true;
    auth.getSession().then(({ data }) => {
      if (active) apply(data.session?.user);
    });
    const { data } = auth.onAuthStateChange((_event, next) => apply(next?.user));
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  if (session.status === "loading") {
    return (
      <main aria-busy="true" className="flex min-h-dvh items-center justify-center bg-surface-02">
        <LoaderCircle aria-label="Loading" className="size-5 animate-spin text-muted-foreground" strokeWidth={1.8} />
      </main>
    );
  }

  if (session.status === "signed-out") return <SignInScreen />;

  return (
    <CloudUserContext.Provider value={{ id: session.id, email: session.email, signOut }}>
      {children}
    </CloudUserContext.Provider>
  );
}

function describeAuthError(message: string) {
  if (/rate limit/i.test(message)) {
    return "Too many sign-in emails were sent. Wait a few minutes and try again.";
  }
  return message;
}

const INPUT_CLASS =
  "h-10 w-full rounded-xl border border-stroke-01 bg-surface-01 px-3 text-[13px] font-medium text-primary outline-none transition-colors placeholder:font-normal placeholder:text-muted-foreground hover:border-stroke-02 focus:border-stroke-02 focus-visible:ring-2 focus-visible:ring-ring/35";

function SignInScreen() {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const sendCode = async () => {
    const address = email.trim().toLowerCase();
    if (!address) return;
    setBusy(true);
    setMessage("");
    const { error } = await getSupabase().auth.signInWithOtp({
      email: address,
      options: { shouldCreateUser: true, emailRedirectTo: window.location.href },
    });
    setBusy(false);
    if (error) {
      setMessage(describeAuthError(error.message));
      return;
    }
    setEmail(address);
    setCode("");
    setStep("code");
  };

  const verifyCode = async () => {
    const token = code.replace(/\s/g, "");
    if (!token) return;
    setBusy(true);
    setMessage("");
    const { error } = await getSupabase().auth.verifyOtp({ email, token, type: "email" });
    setBusy(false);
    // On success the gate swaps this screen for the app.
    if (error) setMessage("That code is wrong or has expired. Check the latest email, or send a new code.");
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface-02 px-4 text-primary">
      <form
        className="w-full max-w-[380px] rounded-[1.25rem] border border-stroke-01 bg-surface-01 p-6 shadow-toolbar"
        onSubmit={(event) => {
          event.preventDefault();
          void (step === "email" ? sendCode() : verifyCode());
        }}
      >
        <div aria-hidden="true" className="mb-5 flex size-10 items-center justify-center rounded-xl bg-primary text-surface-01">
          {step === "email" ? <PanelTop className="size-5" strokeWidth={2} /> : <Mail className="size-5" strokeWidth={2} />}
        </div>

        {step === "email" ? (
          <>
            <h1 className="text-xl font-medium tracking-[-0.03em]">Sign in to Deck</h1>
            <p className="mt-1.5 text-[13px] leading-5 text-muted-foreground">
              Enter your email. We&apos;ll send you a sign-in code.
            </p>
            <label className="mt-5 block text-xs font-medium text-muted-foreground">
              Email
              <input
                autoComplete="email"
                autoFocus
                className={`${INPUT_CLASS} mt-1.5`}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@company.com"
                required
                type="email"
                value={email}
              />
            </label>
          </>
        ) : (
          <>
            <h1 className="text-xl font-medium tracking-[-0.03em]">Check your email</h1>
            <p className="mt-1.5 text-[13px] leading-5 text-muted-foreground">
              We sent a sign-in code to <span className="font-medium text-primary">{email}</span>. Enter it below, or
              click the link in the email.
            </p>
            <label className="mt-5 block text-xs font-medium text-muted-foreground">
              Sign-in code
              <input
                autoComplete="one-time-code"
                autoFocus
                className={`${INPUT_CLASS} mt-1.5 font-mono tracking-[0.3em]`}
                inputMode="numeric"
                maxLength={12}
                onChange={(event) => setCode(event.target.value)}
                placeholder="123456"
                required
                value={code}
              />
            </label>
          </>
        )}

        {message ? (
          <p className="mt-3 rounded-[10px] bg-[#E04E2B]/10 p-3 text-xs text-[#B3361A]" role="alert">
            {message}
          </p>
        ) : null}

        <Button aria-busy={busy} className="mt-5 w-full" disabled={busy} type="submit">
          {busy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" strokeWidth={1.9} /> : null}
          {step === "email" ? "Send code" : "Sign in"}
        </Button>

        {step === "code" ? (
          <div className="mt-3 flex items-center justify-between">
            <Button
              className="px-2 text-muted-foreground"
              onClick={() => {
                setStep("email");
                setMessage("");
              }}
              size="sm"
              variant="ghost"
            >
              <ArrowLeft aria-hidden="true" className="size-3.5" strokeWidth={1.9} />
              Change email
            </Button>
            <Button className="px-2 text-muted-foreground" disabled={busy} onClick={() => void sendCode()} size="sm" variant="ghost">
              Send a new code
            </Button>
          </div>
        ) : null}
      </form>
    </main>
  );
}
