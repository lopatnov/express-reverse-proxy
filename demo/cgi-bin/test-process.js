const method = process.env.REQUEST_METHOD || 'UNKNOWN';
const query = process.env.QUERY_STRING || '';

process.stdout.write('Content-Type: text/plain\r\n');
process.stdout.write('X-Runtime: process\r\n');
process.stdout.write('\r\n');
process.stdout.write(`Executed inside child process. Method: ${method}, Query: ${query}\n`);
process.stdin.pipe(process.stdout);
