export type CollabTask = {
  title: string;
  description: string;
  severity: string;
  filePath?: string;
  lineNumber?: number;
  prUrl?: string;
};

const COLLAB_APP_URL = "https://collab.weez.boo";

export async function listCollabWorkspaces(
  apiKey: string,
): Promise<{ id: string; name: string; slug: string }[]> {
  const res = await fetch(`${COLLAB_APP_URL}/api/workspaces`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Collab API error (${res.status}): ${text}`);
  }

  return res.json();
}

export async function listCollabProjects(
  apiKey: string,
): Promise<{ id: string; name: string; slug: string }[]> {
  const res = await fetch(`${COLLAB_APP_URL}/api/projects`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Collab API error (${res.status}): ${text}`);
  }

  return res.json();
}

export async function createCollabTask(
  apiKey: string,
  projectId: string,
  task: CollabTask,
): Promise<{ id: string }> {
  const res = await fetch(`${COLLAB_APP_URL}/api/projects/${projectId}/tasks`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(task),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Collab API error (${res.status}): ${text}`);
  }

  return res.json();
}
