describe('Reverse proxy routing', () => {
  context('Client A → Users API (:4001)', () => {
    it('proxies GET /api/users and returns an array', () => {
      cy.request('http://localhost:8080/api/users').then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body).to.be.an('array');
        expect(res.body.length).to.be.greaterThan(0);
      });
    });

    it('proxies GET /api/users/1 and returns Alice', () => {
      cy.request('http://localhost:8080/api/users/1').then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body).to.include({ id: 1, name: 'Alice' });
      });
    });

    it('proxies GET /api/users/2 and returns Bob', () => {
      cy.request('http://localhost:8080/api/users/2').then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body).to.include({ id: 2, name: 'Bob' });
      });
    });

    it('proxies GET /api/users/99 and returns 404', () => {
      cy.request({
        url: 'http://localhost:8080/api/users/99',
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.status).to.eq(404);
        expect(res.body).to.have.property('error');
      });
    });
  });

  context('Client B → Products API (:4002)', () => {
    it('proxies GET /api/products and returns an array', () => {
      cy.request('http://localhost:8081/api/products').then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body).to.be.an('array');
        expect(res.body.length).to.be.greaterThan(0);
      });
    });

    it('proxies GET /api/products/1 and returns Widget', () => {
      cy.request('http://localhost:8081/api/products/1').then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body).to.include({ id: 1, name: 'Widget' });
      });
    });

    it('proxies GET /api/products/2 and returns Gadget', () => {
      cy.request('http://localhost:8081/api/products/2').then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body).to.include({ id: 2, name: 'Gadget' });
      });
    });

    it('proxies GET /api/products/99 and returns 404', () => {
      cy.request({
        url: 'http://localhost:8081/api/products/99',
        failOnStatusCode: false,
      }).then((res) => {
        expect(res.status).to.eq(404);
        expect(res.body).to.have.property('error');
      });
    });
  });

  context('Array-of-objects proxy config (:8084)', () => {
    it('routes /api/* to Users API via array proxy entry', () => {
      cy.request('http://localhost:8084/api/users').then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body).to.be.an('array');
        expect(res.body[0]).to.have.property('name');
      });
    });

    it('routes /api/users/1 to Users API and returns Alice', () => {
      cy.request('http://localhost:8084/api/users/1').then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body).to.include({ id: 1, name: 'Alice' });
      });
    });

    it('routes /store/* to Products API via second array proxy entry', () => {
      cy.request('http://localhost:8084/store/products').then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body).to.be.an('array');
        expect(res.body[0]).to.have.property('name');
      });
    });

    it('routes /store/products/1 to Products API and returns Widget', () => {
      cy.request('http://localhost:8084/store/products/1').then((res) => {
        expect(res.status).to.eq(200);
        expect(res.body).to.include({ id: 1, name: 'Widget' });
      });
    });

    it('second array entry does not handle /api/* paths', () => {
      cy.request({ url: 'http://localhost:8084/store/users', failOnStatusCode: false }).then(
        (res) => {
          expect(res.status).to.not.eq(200);
        },
      );
    });
  });

  context('UI interaction', () => {
    it('Client A: clicking Send request loads users JSON', () => {
      cy.visit('http://localhost:8080');
      cy.contains('button', 'Send request').first().click();
      cy.get('#response-output').should('contain', 'Alice');
      cy.get('.status-badge.ok').should('contain', '200');
    });

    it('Client B: clicking Send request loads products JSON', () => {
      cy.visit('http://localhost:8081');
      cy.contains('button', 'Send request').first().click();
      cy.get('#response-output').should('contain', 'Widget');
      cy.get('.status-badge.ok').should('contain', '200');
    });
  });
});
