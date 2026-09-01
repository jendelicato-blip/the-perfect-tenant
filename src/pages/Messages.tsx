import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import * as api from "@/lib/data/api";
import { useAuth } from "@/lib/auth/AuthContext";
import { BackButton } from "@/components/ui/BackButton";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import type { Conversation, Message } from "@/types/domain";

export function ConversationList() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [emails, setEmails] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    api.listConversationsForUser(user.id, user.role).then(async (list) => {
      setConversations(list);
      const entries = await Promise.all(
        list.map(async (c) => {
          const otherId = c.tenant_id === user.id ? c.landlord_id : c.tenant_id;
          return [otherId, (await api.getUserEmail(otherId)) ?? "Unknown"] as const;
        }),
      );
      setEmails(Object.fromEntries(entries));
    });
  }, [user]);

  if (!user) return null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">Messages</h1>
      <div className="mt-6 space-y-2">
        {conversations.length === 0 && <p className="text-sm text-slate-500">No conversations yet.</p>}
        {conversations.map((c) => {
          const otherId = c.tenant_id === user.id ? c.landlord_id : c.tenant_id;
          return (
            <Link key={c.id} to={`/messages/${c.id}`}>
              <Card className="p-4 hover:border-brand-300">
                <p className="font-medium text-slate-900">{emails[otherId] ?? "…"}</p>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function ConversationThread() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");

  useEffect(() => {
    if (!conversationId) return;
    api.listMessages(conversationId).then(setMessages);
  }, [conversationId]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!conversationId || !user || !body.trim()) return;
    const message = await api.sendMessage(conversationId, user.id, body.trim());
    setMessages((prev) => [...prev, message]);
    setBody("");
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <BackButton fallback="/messages" className="mb-4" />
      <h1 className="text-xl font-bold text-slate-900">Conversation</h1>
      <div className="mt-4 space-y-3">
        {messages.map((m) => (
          <div key={m.id} className={`max-w-[80%] rounded-xl px-4 py-2 text-sm ${m.sender_id === user?.id ? "ml-auto bg-brand-600 text-white" : "bg-white border border-slate-200"}`}>
            {m.body}
          </div>
        ))}
      </div>
      <form onSubmit={handleSend} className="mt-6 flex gap-2">
        <Input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Type a message…" />
        <Button type="submit">Send</Button>
      </form>
    </div>
  );
}
