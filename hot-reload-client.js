/**
 * Hot Reload Client — connect via SSE and reload the page when files change.
 *
 * Usage (choose one):
 *
 *   <!-- as a plain script tag -->
 *   <script src="/__hot-reload__/client.js"></script>
 *
 *   <!-- as an ES module (bundler resolves via package.json exports) -->
 *   import '@lopatnov/express-reverse-proxy/hot-reload-client';
 *
 * The server must have `"hotReload": true` in its server-config.json.
 */
(function hotReloadClient() {
  var url = '/__hot-reload__';

  function connect() {
    var es = new EventSource(url);

    es.onmessage = () => {
      location.reload();
    };

    es.onerror = () => {
      es.close();
      setTimeout(connect, 3000);
    };
  }

  connect();
})();
