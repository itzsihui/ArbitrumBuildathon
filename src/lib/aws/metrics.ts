import type { ProtocolEvent } from "@/lib/store/types";

/** CloudWatch Embedded Metric Format — picked up automatically from Lambda logs. */
export function emitProtocolMetric(status: number, rail?: string) {
  if (!process.env.AWS_LAMBDA_FUNCTION_NAME) return;
  const bucket =
    status === 402 ? "PaymentRequired" : status === 200 ? "Paid" : "Other";
  const payload = {
    _aws: {
      Timestamp: Date.now(),
      CloudWatchMetrics: [
        {
          Namespace: "Borneo/Protocol",
          Dimensions: [["Status"], ["Rail"]],
          Metrics: [
            { Name: "Requests", Unit: "Count" },
            { Name: "Http402", Unit: "Count" },
            { Name: "Http200", Unit: "Count" },
          ],
        },
      ],
    },
    Status: bucket,
    Rail: rail || "unknown",
    Requests: 1,
    Http402: status === 402 ? 1 : 0,
    Http200: status === 200 ? 1 : 0,
  };
  console.log(JSON.stringify(payload));
}

export function logProtocolLine(event: ProtocolEvent) {
  // Plain lines for CloudWatch metric filters: HTTP 402 / HTTP 200
  console.log(
    `borneo ${event.method} ${event.path} HTTP ${event.status} ${event.message}`,
  );
}
