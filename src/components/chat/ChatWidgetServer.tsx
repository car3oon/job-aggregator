import { isAuthenticated } from "@/lib/auth";
import { ChatWidget } from "./ChatWidget";

export async function ChatWidgetServer() {
  const isLoggedIn = await isAuthenticated();
  if (!isLoggedIn) return null;

  const apiKey =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
  const isConfigured = Boolean(apiKey && apiKey.trim());
  const modelName =
    process.env.GEMINI_MODEL ||
    process.env.AI_MODEL ||
    "gemini-flash-lite-latest";

  return <ChatWidget isConfigured={isConfigured} modelName={modelName} />;
}
