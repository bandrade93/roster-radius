import type { AnalysisRequest, AnalysisResult, WorkerRequest, WorkerResponse } from './protocol';

/** Sends requests to the analysis worker and resolves each with its answer. */
export class AnalysisClient {
  private next = 1;
  private readonly pending = new Map<number, (result: AnalysisResult) => void>();

  constructor(private readonly worker: Worker) {
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const { id, ...result } = event.data;
      this.pending.get(id)?.(result as AnalysisResult);
      this.pending.delete(id);
    };
  }

  request(request: AnalysisRequest): Promise<AnalysisResult> {
    const id = this.next++;
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      this.worker.postMessage({ ...request, id } satisfies WorkerRequest);
    });
  }
}

export function createAnalysisClient(): AnalysisClient {
  return new AnalysisClient(new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module', name: 'rosterradius-analysis' }));
}
