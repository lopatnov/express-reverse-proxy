const method = process.env.REQUEST_METHOD || 'GET';

process.stdout.write('Content-Type: text/plain\r\n');
process.stdout.write('X-Runtime: worker\r\n');
process.stdout.write('\r\n');
process.stdout.write(`Executed inside Worker Thread. Method: ${method}\n`);
process.stdin.pipe(process.stdout);
