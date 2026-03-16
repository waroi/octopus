import { getSystemReviewConfig } from "../model-actions";
import { ReviewDefaultsManager } from "../review-defaults-manager";

export default async function AdminReviewDefaultsPage() {
  const config = await getSystemReviewConfig();

  return <ReviewDefaultsManager initialConfig={config} />;
}
