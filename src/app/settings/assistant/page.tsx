import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { AiAssistantSettings } from "@/components/AiAssistantSettings";

export default async function AssistantSettingsPage() {
  if (!(await isAuthenticated())) {
    redirect("/login");
  }

  const aiApiKey =
    process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
  const isAiConfigured = Boolean(aiApiKey && aiApiKey.trim());
  const maskedApiKey =
    aiApiKey && aiApiKey.length > 8
      ? `${aiApiKey.slice(0, 4)}...${aiApiKey.slice(-4)}`
      : null;
  const aiModel =
    process.env.GEMINI_MODEL ||
    process.env.AI_MODEL ||
    "gemini-flash-lite-latest";

  return (
    <div className="bg-card text-card-foreground rounded-xl border shadow-sm p-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold">AI Assistant Settings</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Configure the Google Gemini model and credentials for the
          conversational assistant.
        </p>
      </div>
      <AiAssistantSettings
        isConfigured={isAiConfigured}
        maskedApiKey={maskedApiKey}
        currentModel={aiModel}
      />
    </div>
  );
}
