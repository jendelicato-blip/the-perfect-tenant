import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth/AuthContext";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormRow, Input } from "@/components/ui/Field";

const DEMO_ACCOUNTS = [
  { label: "Tenant — Amara", email: "amara.tenant@example.com" },
  { label: "Tenant — Devon", email: "devon.tenant@example.com" },
  { label: "Landlord — Priya", email: "priya.landlord@example.com" },
  { label: "Landlord — Marcus", email: "marcus.landlord@example.com" },
];
const DEMO_PASSWORD = "password123";

export function Login() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <Card className="p-6">
        <h1 className="text-xl font-semibold text-slate-900">Log in</h1>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <FormRow label="Email">
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </FormRow>
          <FormRow label="Password">
            <Input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </FormRow>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Signing in…" : "Log in"}
          </Button>
        </form>

        <div className="mt-6 border-t border-slate-200 pt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Demo accounts (password: {DEMO_PASSWORD})
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {DEMO_ACCOUNTS.map((a) => (
              <button
                key={a.email}
                type="button"
                onClick={() => {
                  setEmail(a.email);
                  setPassword(DEMO_PASSWORD);
                }}
                className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-600 hover:bg-slate-50"
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
