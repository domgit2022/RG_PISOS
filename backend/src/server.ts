import { app } from "@/app.js";
import { env } from "@/config/env.js";
import { startReorderCheckJob } from "@/jobs/reorder-check.job.js";
import { startExpiryCheckJob } from "@/jobs/expiry-check.job.js";

app.listen(env.PORT, () => {
  console.log(`API escuchando en http://localhost:${env.PORT}`);
  startReorderCheckJob();
  startExpiryCheckJob();
});
