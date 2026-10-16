import fxEmbedWorker from './fxembed/dist/worker.js';

const statusPath = /^\/[^/]+\/status(?:es)?\/\d+(?:\/.*)?\/?$/;
const activityApiPath = /^\/api\/v1\/statuses\/\d+\/?$/;

export default {
  async fetch(
    request: Request,
    env: Parameters<typeof fxEmbedWorker.fetch>[1],
    ctx: Parameters<typeof fxEmbedWorker.fetch>[2]
  ): Promise<Response> {
    const url = new URL(request.url);

    if (
      (request.method === 'GET' || request.method === 'HEAD') &&
      (statusPath.test(url.pathname) || activityApiPath.test(url.pathname))
    ) {
      return fxEmbedWorker.fetch(request, env, ctx);
    }

    // Worker routes cover bagof.fish/*, so pass non-status URLs to the existing Pages origin.
    return fetch(request);
  }
};
