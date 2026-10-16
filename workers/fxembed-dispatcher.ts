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
      const response = await fxEmbedWorker.fetch(request, env, ctx);

      // Discord expects theme-color as a standard name attribute. FxEmbed currently emits
      // property="theme-color", so normalize it on HTML responses to make the accent color apply.
      if (
        request.method === 'GET' &&
        response.headers.get('content-type')?.toLowerCase().includes('text/html')
      ) {
        const html = await response.text();
        const normalizedHtml = html.replace(
          /<meta\s+property=(["'])theme-color\1/gi,
          '<meta name="theme-color"'
        );

        if (normalizedHtml !== html) {
          return new Response(normalizedHtml, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers
          });
        }

        return new Response(html, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers
        });
      }

      return response;
    }

    // Worker routes cover bagof.fish/*, so pass non-status URLs to the existing Pages origin.
    return fetch(request);
  }
};
