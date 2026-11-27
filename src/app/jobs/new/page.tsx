import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { isAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AddJobForm } from "@/components/AddJobForm";

export default async function NewJobPage() {
  if (!(await isAuthenticated())) {
    redirect("/login");
  }

  const [categories, workPreferences] = await Promise.all([
    prisma.category.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.workPreference.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-300">
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Dashboard</span>
        </Link>
        <h1 className="text-3xl font-bold tracking-tight">Add Job Offer</h1>
        <p className="text-muted-foreground mt-1">
          Paste an offer from an external portal to track it in your Inbox and
          run AI Analysis or Interview Prep.
        </p>
      </div>

      <div className="bg-card text-card-foreground rounded-xl border shadow-sm p-6">
        <AddJobForm
          categories={categories}
          workPreferences={workPreferences}
        />
      </div>
    </div>
  );
}
