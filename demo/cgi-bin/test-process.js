const ESCAPE_HTML_CHARS = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ESCAPE_HTML_CHARS[char]);

const method = escapeHtml(process.env.REQUEST_METHOD || 'UNKNOWN');
const query = escapeHtml(process.env.QUERY_STRING || '');

process.stdout.write('Content-Type: text/html\r\n');
process.stdout.write('X-Runtime: process\r\n');
process.stdout.write('\r\n');
process.stdout.write(
  `<html>
    <body>
        <h1>CGI Script Output</h1>
        <p>Executed inside child process. Method: ${method}, Query: ${query}</p>
    </body>
  </html>`,
);
process.stdin.pipe(process.stdout);
