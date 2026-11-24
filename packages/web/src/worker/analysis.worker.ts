import type { WorkerRequest, WorkerResponse } from './protocol';
import { AnalysisSession } from './session';

/** The parts of the worker's global scope this file uses. */
interface Scope {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(message: WorkerResponse): void;
}

const scope = self as unknown as Scope;
const session = new AnalysisSession();

scope.onmessage = async (event) => {
  const { id, ...request } = event.data;
  const result = await session.handle(request);
  scope.postMessage({ ...result, id });
};
