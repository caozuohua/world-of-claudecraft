// The RED /metrics exporter core (Phase 23 of docs/api-pipeline/): a prom-client
// registry plus a MetricSink (server/http/middleware/metric_sink.ts) that turns
// each per-request MetricEvent into a Prometheus Counter increment and Histogram
// observation. RED = Rate (the request counter), Errors (the status label), and
// Duration (the latency histogram).
//
// CARDINALITY IS BOUNDED BY DESIGN. The only three labels are route, method, and
// status, and `route` is ALWAYS the :param TEMPLATE the caller of withMetrics
// passes (e.g. '/api/characters/:id'), never a concrete path, so a million
// distinct ids collapse onto one series. method is uppercased and status is the
// numeric code; nothing request-derived (ip, query, body) ever becomes a label.
//
// EACH factory call builds its OWN Registry and registers the metrics ONLY on it
// (never the prom-client global default register), so many instances coexist in a
// test file with no duplicate-registration throw and no cross-talk. Server-side,
// language-agnostic: no t(), no DOM, no sim/client imports.

import { Counter, collectDefaultMetrics, Histogram, Registry } from 'prom-client';
import type { MetricEvent, MetricSink } from './middleware/metric_sink';

/** The request-counter metric name (RED: Rate + Errors via the status label). */
export const HTTP_REQUESTS_TOTAL = 'http_requests_total';

/** The request-duration histogram metric name, in SECONDS (RED: Duration). */
export const HTTP_REQUEST_DURATION_SECONDS = 'http_request_duration_seconds';

/**
 * The complete, bounded label set shared by both metrics. `route` is the :param
 * template, `method` is uppercased, `status` is the numeric code as a string.
 * Nothing request-derived (ip, query, body) is ever added here.
 */
const HTTP_METRIC_LABELS = ['route', 'method', 'status'] as const;

/**
 * RED latency buckets in SECONDS: 5 ms up to 10 s. Chosen for typical API request
 * durations (sub-millisecond reads through multi-second slow paths).
 */
export const HTTP_DURATION_BUCKETS_SECONDS = [
  0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
] as const;

/** Milliseconds per second, for the durationMs -> seconds conversion at observe time. */
const MS_PER_SECOND = 1000;

/** Options for {@link createHttpMetrics}. */
export interface CreateHttpMetricsOptions {
  /**
   * When true, attach prom-client's default process/runtime metrics (event loop,
   * heap, gc, ...) to THIS instance's registry only, never the global register.
   */
  defaultMetrics?: boolean;
}

/** The exporter instance a caller wires into the server: a registry, a sink, and the text dump. */
export interface HttpMetrics {
  /** This instance's private registry (never the prom-client global default). */
  registry: Registry;
  /** The per-request sink to hand to withMetrics; its record() never throws. */
  sink: MetricSink;
  /** The Prometheus exposition text for a /metrics response body. */
  metricsText(): Promise<string>;
  /** The Content-Type to send with the exposition text. */
  contentType: string;
}

/**
 * Build a self-contained RED metrics exporter. Each call creates a NEW Registry
 * and registers the request Counter and duration Histogram ONLY on it, so
 * instances are fully isolated (safe to build many in one test, including one with
 * defaultMetrics: true, with no duplicate-registration throw and no cross-talk).
 *
 * The returned sink increments http_requests_total and observes
 * http_request_duration_seconds (durationMs / 1000) with the bounded label set
 * { route: event.route verbatim, method: uppercased, status: String(status) }. It
 * NEVER throws: the label build is guarded so a malformed event is dropped rather
 * than propagated into the request's finally block.
 */
export function createHttpMetrics(opts: CreateHttpMetricsOptions = {}): HttpMetrics {
  const registry = new Registry();

  const requests = new Counter({
    name: HTTP_REQUESTS_TOTAL,
    help: 'Total HTTP requests handled, labeled by route template, method, and status.',
    labelNames: HTTP_METRIC_LABELS,
    registers: [registry],
  });

  const duration = new Histogram({
    name: HTTP_REQUEST_DURATION_SECONDS,
    help: 'HTTP request duration in seconds, labeled by route template, method, and status.',
    labelNames: HTTP_METRIC_LABELS,
    buckets: [...HTTP_DURATION_BUCKETS_SECONDS],
    registers: [registry],
  });

  if (opts.defaultMetrics) {
    collectDefaultMetrics({ register: registry });
  }

  const sink: MetricSink = {
    record(event: MetricEvent): void {
      try {
        const labels = {
          route: event.route,
          method: event.method.toUpperCase(),
          status: String(event.status),
        };
        requests.inc(labels);
        duration.observe(labels, event.durationMs / MS_PER_SECOND);
      } catch {
        // A metric write must never break the request it is measuring; drop the
        // sample rather than propagate. prom-client is safe for the bounded label
        // set above, so this only guards a genuinely malformed event.
      }
    },
  };

  return {
    registry,
    sink,
    metricsText: () => registry.metrics(),
    contentType: registry.contentType,
  };
}
