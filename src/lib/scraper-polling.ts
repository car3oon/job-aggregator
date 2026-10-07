export type ScraperStatus = {
  status: string;
  runId?: number;
  conclusion?: string | null;
  url?: string | null;
  updatedAt?: string;
  createdAt?: string;
};

export type ScraperDispatch = { requestedAt: string; previousRunId?: number };

export function isScraperActive(status: string) {
  return ["queued", "in_progress", "waiting", "pending", "requested"].includes(status);
}

export function watchScraperStatus(
  fetchStatus: () => Promise<ScraperStatus>,
  onStatus: (status: ScraperStatus) => void,
  dispatch?: ScraperDispatch,
) {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let foundRun = !dispatch;
  let hasActiveRun = false;
  let failures = 0;
  const startedAt = Date.now();
  // GitHub timestamps have second precision.
  const requestedAt = dispatch ? Math.floor(Date.parse(dispatch.requestedAt) / 1000) * 1000 : 0;

  const stop = () => {
    stopped = true;
    clearTimeout(timer);
  };

  const retry = () => {
    timer = setTimeout(() => { void check(); }, 5000);
  };

  const check = async () => {
    let status: ScraperStatus;
    try {
      status = await fetchStatus();
    } catch {
      status = { status: "unknown" };
    }
    if (stopped) return;

    const elapsed = Date.now() - startedAt;
    if (elapsed >= 10 * 60_000) {
      onStatus({ status: "unknown" });
      stop();
      return;
    }

    if (!foundRun && dispatch) {
      foundRun = status.runId !== undefined && (dispatch.previousRunId !== undefined
        ? status.runId !== dispatch.previousRunId
        : Boolean(status.createdAt && Date.parse(status.createdAt) >= requestedAt));
      if (!foundRun) {
        if (elapsed >= 60_000) {
          onStatus({ status: "unknown" });
          stop();
        } else {
          retry();
        }
        return;
      }
    }

    if (status.status === "unknown" && hasActiveRun && failures++ < 2) {
      retry();
      return;
    }
    failures = 0;
    onStatus(status);
    if (isScraperActive(status.status)) {
      hasActiveRun = true;
      retry();
    }
    else stop();
  };

  void check();
  return stop;
}
