"use server";

export async function triggerScraperAction() {
  const token = process.env.GITHUB_TOKEN;
  
  if (!token) {
    return { success: false, error: "Missing GITHUB_TOKEN environment variable." };
  }

  try {
    const response = await fetch(
      "https://api.github.com/repos/car3oon/job-aggregator/actions/workflows/scraper.yml/dispatches",
      {
        method: "POST",
        headers: {
          "Accept": "application/vnd.github.v3+json",
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json",
          "User-Agent": "Job-Aggregator-App"
        },
        body: JSON.stringify({
          ref: "main" // Change to master if your default branch is master
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `GitHub API error: ${response.status} - ${errorText}` };
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message || "Failed to trigger scraper." };
  }
}

export async function getScraperStatusAction() {
  const token = process.env.GITHUB_TOKEN;
  
  if (!token) return { status: "unknown", url: null };

  try {
    const response = await fetch(
      "https://api.github.com/repos/car3oon/job-aggregator/actions/workflows/scraper.yml/runs?per_page=1",
      {
        headers: {
          "Accept": "application/vnd.github.v3+json",
          "Authorization": `Bearer ${token}`,
          "User-Agent": "Job-Aggregator-App"
        },
        cache: "no-store" // ensure we get the fresh status
      }
    );

    if (response.ok) {
      const data = await response.json();
      if (data.workflow_runs && data.workflow_runs.length > 0) {
        const run = data.workflow_runs[0];
        return {
          status: run.status, // "queued", "in_progress", "completed"
          conclusion: run.conclusion, // "success", "failure", etc.
          url: run.html_url
        };
      }
    }
  } catch (error) {
    // Ignore errors for status check
  }
  return { status: "unknown", url: null };
}
