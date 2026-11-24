import type { AnalysisRequest, Answer, WorkerRequest, WorkerResponse } from './protocol';

/** Sends requests to the analysis worker and resolves each with its answer. */
export class AnalysisClient {
  private next = 1;
  private readonly pending = new Map<number, (answer: WorkerResponse) => void>();

  constructor(private readonly worker: Worker) {
    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      this.pending.get(event.data.id)?.(event.data);
      this.pending.delete(event.data.id);
    };
  }

  request<R extends AnalysisRequest>(request: R): Promise<Answer<R['type']>> {
    const id = this.next++;

    return new Promise((resolve) => {
      this.pending.set(id, ({ id: _, ...answer }) => resolve(answer as Answer<R['type']>));
      this.worker.postMessage({ ...request, id } satisfies WorkerRequest);
    });
  }
}

export function createAnalysisClient(): AnalysisClient {
  return new AnalysisClient(new Worker(new URL('./analysis.worker.ts', import.meta.url), { type: 'module', name: 'rosterradius-analysis' }));
}
