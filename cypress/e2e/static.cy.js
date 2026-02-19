describe('Static file serving', () => {
  it('serves Client A on port 8080', () => {
    cy.visit('http://localhost:8080');
    cy.get('title').should('contain', 'express-reverse-proxy');
    cy.contains('express-reverse-proxy').should('be.visible');
  });

  it('serves Client A index.html with correct content', () => {
    cy.visit('http://localhost:8080');
    cy.contains('Users API Demo').should('be.visible');
    cy.contains('Client A').should('be.visible');
  });

  it('serves Client B on port 8081', () => {
    cy.visit('http://localhost:8081');
    cy.contains('Products API Demo').should('be.visible');
    cy.contains('Client B').should('be.visible');
  });

  it('serves static CSS on Client A', () => {
    cy.request('http://localhost:8080/style.css').then((res) => {
      expect(res.status).to.eq(200);
      expect(res.headers['content-type']).to.include('text/css');
    });
  });

  it('serves static CSS on Client B', () => {
    cy.request('http://localhost:8081/style.css').then((res) => {
      expect(res.status).to.eq(200);
      expect(res.headers['content-type']).to.include('text/css');
    });
  });

  it('returns custom X-Powered-By header on Client A', () => {
    cy.request('http://localhost:8080').then((res) => {
      expect(res.headers['x-powered-by']).to.eq('express-reverse-proxy');
    });
  });

  it('returns custom X-Client header on Client A', () => {
    cy.request('http://localhost:8080').then((res) => {
      expect(res.headers['x-client']).to.eq('A');
    });
  });

  it('returns custom X-Client header on Client B', () => {
    cy.request('http://localhost:8081').then((res) => {
      expect(res.headers['x-client']).to.eq('B');
    });
  });

  it('redirects unknown HTML route to / on Client A (unhandled)', () => {
    cy.request({
      url: 'http://localhost:8080/does-not-exist',
      followRedirect: false,
      headers: { Accept: 'text/html' },
    }).then((res) => {
      expect(res.status).to.eq(307);
      expect(res.headers['location']).to.eq('/');
    });
  });

  it('returns 404 JSON for unknown API route on Client A (unhandled)', () => {
    cy.request({
      url: 'http://localhost:8080/nonexistent-json',
      failOnStatusCode: false,
      headers: { Accept: 'application/json' },
    }).then((res) => {
      expect(res.status).to.eq(404);
      expect(res.body).to.deep.equal({ error: 'Not Found' });
    });
  });
});
