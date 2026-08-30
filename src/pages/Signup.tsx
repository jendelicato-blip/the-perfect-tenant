import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/lib/auth/AuthContext";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FormRow, Input } from "@/components/ui/Field";
import type { Role } from "@/types/domain";

export function Signup() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [role, setRole] = useState<Role>((params.get("role") as Role) ?? "tenant");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signUp(email, password, role);
      navigate(role === "tenant" ? "/onboarding" : "/landlord");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <Card className="p-6">
        <h1 className="text-xl font-semibold text-slate-900">Create your account</h1>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {(["tenant", "landlord"] as Role[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium capitalize ${
                role === r ? "border-brand-600 bg-brand-50 text-brand-700" : "border-slate-300 text-slate-600"
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <FormRow label="Email">
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </FormRow>
          <FormRow label="Password">
            <Input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
          </FormRow>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Creating account…" : "Sign up"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
