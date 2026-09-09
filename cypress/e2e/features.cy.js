describe('healthCheck', () => {
  it('returns 200 with status ok on GET /__health__', () => {
    cy.request('http://localhost:8080/__health__').then((res) => {
      expect(res.status).to.eq(200);
      expect(res.body.status).to.eq('ok');
      expect(res.body.uptime).to.be.a('number');
      expect(res.body.timestamp).to.be.a('string');
    });
  });
});

describe('redirects', () => {
  it('301 redirect: /old-page → /', () => {
    cy.request({
      url: 'http://localhost:8080/old-page',
      followRedirect: false,
    }).then((res) => {
      expect(res.status).to.eq(301);
      expect(res.headers.location).to.eq('/');
    });
  });

  it('302 redirect: /legacy → /', () => {
    cy.request({
      url: 'http://localhost:8080/legacy',
      followRedirect: false,
    }).then((res) => {
      expect(res.status).to.eq(302);
      expect(res.headers.location).to.eq('/');
    });
  });
});

describe('responseTime', () => {
  it('returns X-Response-Time header on every response', () => {
    cy.request('http://localhost:8080').then((res) => {
      expect(res.headers['x-response-time']).to.match(/^\d+(\.\d+)?ms$/);
    });
  });
});

describe('cors', () => {
  it('returns Access-Control-Allow-Origin for cross-origin request', () => {
    cy.request({
      url: 'http://localhost:8080',
      headers: { Origin: 'http://example.com' },
    }).then((res) => {
      expect(res.headers['access-control-allow-origin']).to.be.a('string');
    });
  });
});

describe('helmet', () => {
  it('returns X-Content-Type-Options: nosniff', () => {
    cy.request('http://localhost:8080').then((res) => {
      expect(res.headers['x-content-type-options']).to.eq('nosniff');
    });
  });

  it('returns X-Frame-Options header', () => {
    cy.request('http://localhost:8080').then((res) => {
      expect(res.headers['x-frame-options']).to.be.a('string');
    });
  });
});

describe('compression', () => {
  it('sets Vary: Accept-Encoding', () => {
    cy.request('http://localhost:8080').then((res) => {
      expect(res.headers.vary).to.include('Accept-Encoding');
    });
  });
});

describe('hotReload', () => {
  it('publishes a reload event when a CGI file changes', () => {
    let reloadEvent;

    cy.visit('http://localhost:8080');
    cy.window().then(
      (win) =>
        new Cypress.Promise((resolve, reject) => {
          const source = new win.EventSource('/__hot-reload__');
          const readyTimeout = win.setTimeout(() => {
            source.close();
            reject(new Error('Timed out connecting to the hot reload event stream'));
          }, 5000);

          source.onopen = () => {
            win.clearTimeout(readyTimeout);
            reloadEvent = new Cypress.Promise((resolveReload, rejectReload) => {
              const reloadTimeout = win.setTimeout(() => {
                source.close();
                rejectReload(new Error('Timed out waiting for the hot reload event'));
              }, 5000);
              source.onmessage = (event) => {
                win.clearTimeout(reloadTimeout);
                source.close();
                resolveReload(event.data);
              };
              source.onerror = () => {
                win.clearTimeout(reloadTimeout);
                source.close();
                rejectReload(new Error('Hot reload event stream failed'));
              };
            });
            resolve();
          };
          source.onerror = () => {
            win.clearTimeout(readyTimeout);
            source.close();
            reject(new Error('Failed to connect to the hot reload event stream'));
          };
        }),
    );

    cy.exec(
      "node -e \"const fs = require('node:fs'); const file = 'demo/cgi-bin/.hot-reload-test.tmp'; fs.writeFileSync(file, ''); fs.rmSync(file);\"",
    );
    cy.then(() => reloadEvent).should('eq', 'reload');
  });
});

describe('basicAuth', () => {
  it('returns 401 without credentials', () => {
    cy.request({ url: 'http://localhost:8082/', failOnStatusCode: false }).then((res) => {
      expect(res.status).to.eq(401);
    });
  });

  it('returns 200 with valid credentials', () => {
    cy.request({ url: 'http://localhost:8082/', auth: { user: 'admin', pass: 'secret' } }).then(
      (res) => {
        expect(res.status).to.eq(200);
      },
    );
  });
});

describe('rateLimit', () => {
  it('returns 429 after exceeding the limit', () => {
    // limit is 3; consume all slots
    cy.request({ url: 'http://localhost:8083/', failOnStatusCode: false });
    cy.request({ url: 'http://localhost:8083/', failOnStatusCode: false });
    cy.request({ url: 'http://localhost:8083/', failOnStatusCode: false });
    // 4th request must be blocked
    cy.request({ url: 'http://localhost:8083/', failOnStatusCode: false }).then((res) => {
      expect(res.status).to.eq(429);
    });
  });
});

describe('upload', () => {
  const url = 'http://localhost:8086/upload';
  const boundary = '----TestBoundary123';

  function multipart(files) {
    return files
      .map(
        ({ name, content, type }) =>
          `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: ${type}\r\n\r\n${content}`,
      )
      .join('\r\n')
      .concat(`\r\n--${boundary}--`);
  }

  it('returns 200 with file info on valid upload', () => {
    cy.request({
      method: 'POST',
      url,
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body: multipart([{ name: 'test.txt', content: 'hello', type: 'text/plain' }]),
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.eq(200);
      expect(res.body.files).to.have.length(1);
      expect(res.body.files[0].originalName).to.eq('test.txt');
    });
  });

  it('returns 413 when file exceeds maxFileSize (1024 bytes)', () => {
    cy.request({
      method: 'POST',
      url,
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body: multipart([{ name: 'big.txt', content: 'x'.repeat(2048), type: 'text/plain' }]),
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.eq(413);
      expect(res.body.error).to.be.a('string');
    });
  });

  it('returns 400 when number of files exceeds maxFiles (2)', () => {
    cy.request({
      method: 'POST',
      url,
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body: multipart([
        { name: 'a.txt', content: 'a', type: 'text/plain' },
        { name: 'b.txt', content: 'b', type: 'text/plain' },
        { name: 'c.txt', content: 'c', type: 'text/plain' },
      ]),
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.eq(400);
      expect(res.body.error).to.be.a('string');
    });
  });

  it('returns 400 when file type is not in allowedTypes', () => {
    cy.request({
      method: 'POST',
      url,
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body: multipart([{ name: 'img.png', content: 'fakepng', type: 'image/png' }]),
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.eq(400);
      expect(res.body.error).to.be.a('string');
    });
  });

  it('returns 400 when field name does not match fieldName (LIMIT_UNEXPECTED_FILE)', () => {
    const strictUrl = 'http://localhost:8086/upload-strict';
    // fieldName is "file"; sending under "data" triggers LIMIT_UNEXPECTED_FILE
    const body = `--${boundary}\r\nContent-Disposition: form-data; name="data"; filename="test.txt"\r\nContent-Type: text/plain\r\n\r\nhello\r\n--${boundary}--`;
    cy.request({
      method: 'POST',
      url: strictUrl,
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
      body,
      failOnStatusCode: false,
    }).then((res) => {
      expect(res.status).to.eq(400);
      expect(res.body.error).to.be.a('string');
    });
  });
});

describe('cgi', () => {
  it('executes Node.js worker via GET /cgi-bin/test-worker.js', () => {
    cy.request('http://localhost:8080/cgi-bin/test-worker.js').then((res) => {
      expect(res.status).to.eq(200);
      expect(res.headers['x-runtime']).to.eq('worker');
      expect(res.body).to.include('Executed inside Worker Thread. Method: GET');
    });
  });

  it('streams request body through Node.js worker via POST /cgi-bin/test-worker.js', () => {
    cy.request({
      method: 'POST',
      url: 'http://localhost:8080/cgi-bin/test-worker.js',
      body: 'streamed payload data',
      headers: { 'Content-Type': 'text/plain' },
    }).then((res) => {
      expect(res.status).to.eq(200);
      expect(res.headers['x-runtime']).to.eq('worker');
      expect(res.body).to.include('Executed inside Worker Thread. Method: POST');
      expect(res.body).to.include('streamed payload data');
    });
  });

  it('executes traditional process CGI via GET /cgi-process/test-process.js', () => {
    cy.request('http://localhost:8080/cgi-process/test-process.js?greeting=hello').then((res) => {
      expect(res.status).to.eq(200);
      expect(res.headers['x-runtime']).to.eq('process');
      expect(res.body).to.include('Executed inside child process');
      expect(res.body).to.include('greeting=hello');
    });
  });

  it('executes Python process CGI via GET /cgi-bin/test-python.py', () => {
    cy.request('http://localhost:8080/cgi-bin/test-python.py?name=John').then((res) => {
      expect(res.status).to.eq(200);
      expect(res.headers['x-runtime']).to.eq('python-process');
      expect(res.body).to.include('Executed inside Python process');
      expect(res.body).to.include('Query: name=John');
    });
  });

  it('returns 504 on script timeout /cgi-bin/timeout-worker.js', () => {
    cy.request({
      url: 'http://localhost:8080/cgi-bin/timeout-worker.js',
      failOnStatusCode: false,
      timeout: 10000,
    }).then((res) => {
      expect(res.status).to.eq(504);
      expect(res.body).to.eq('CGI Timeout');
    });
  });
});
