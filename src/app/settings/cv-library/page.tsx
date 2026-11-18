import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { listCvVersions } from "@/app/actions/cvActions";
import { CvLibraryTab } from "@/components/CvLibraryTab";

export default async function CvLibrarySettingsPage() {
  if (!(await isAuthenticated())) {
    redirect("/login");
  }

  const cvVersions = await listCvVersions();

  return (
    <div className="bg-card text-card-foreground rounded-xl border shadow-sm p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">CV Library</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Upload and manage CV versions (PDF or DOCX, max 5 MB each) for
            AI-powered job match analysis.
          </p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground shrink-0">
          {cvVersions.length} / 10
        </span>
      </div>
      <CvLibraryTab initialCvs={cvVersions} />
    </div>
  );
}
