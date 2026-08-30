import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import * as api from "@/lib/data/api";
import { useAuth } from "@/lib/auth/AuthContext";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import type { Conversation, Message, User } from "@/types/domain";
import { getDb } from "@/lib/data/localStore";

function otherPartyEmail(conversation: Conversation, currentUserId: string): string {
  const db = getDb();
  const otherId = conversation.tenant_id === currentUserId ? conversation.landlord_id : conversation.tenant_id;
  const other = db.users.find((u: User) => u.id === otherId);
  return other?.email ?? "Unknown";
}

export function ConversationList() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    if (!user) return;
    api.listConversationsForUser(user.id, user.role).then(setConversations);
  }, [user]);

  if (!user) return null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold text-slate-900">Messages</h1>
      <div className="mt-6 space-y-2">
        {conversations.length === 0 && <p className="text-sm text-slate-500">No conversations yet.</p>}
        {conversations.map((c) => (
          <Link key={c.id} to={`/messages/${c.id}`}>
            <Card className="p-4 hover:border-brand-300">
              <p className="font-medium text-slate-900">{otherPartyEmail(c, user.id)}</p>
            </Card>
          </Link>
        ))}
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
