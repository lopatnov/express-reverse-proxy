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
      expect(res.headers['access-control-allow-origin']).to.exist;
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
      expect(res.headers['x-frame-options']).to.exist;
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
