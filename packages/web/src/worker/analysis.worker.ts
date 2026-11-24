import type { AnalysisRequest, WorkerRequest, WorkerResponse } from './protocol';
import { AnalysisSession } from './session';

interface Scope {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage(message: WorkerResponse): void;
}

const scope = self as unknown as Scope;
const session = new AnalysisSession();

scope.onmessage = async (event) => {
  const { id, ...request } = event.data;
  const answer = await session.handle(request as AnalysisRequest);

  scope.postMessage({ ...answer, id });
};
