describe('env filter (--env dev+featureA)', () => {
  it('starts both dev sites (duplicate env name)', () => {
    cy.request('http://localhost:8090').then((res) => {
      expect(res.status).to.eq(200);
      expect(res.headers['x-env-site']).to.eq('dev-1');
      expect(res.body).to.include('env: dev — site 1');
    });
    cy.request('http://localhost:8091').then((res) => {
      expect(res.status).to.eq(200);
      expect(res.headers['x-env-site']).to.eq('dev-2');
      expect(res.body).to.include('duplicate env name');
    });
  });

  it('starts featureA site', () => {
    cy.request('http://localhost:8092').then((res) => {
      expect(res.status).to.eq(200);
      expect(res.headers['x-env-site']).to.eq('featureA');
      expect(res.body).to.include('env: featureA');
    });
  });

  it('does not start featureB/staging site (not in filter)', () => {
    cy.task('isPortListening', 'http://localhost:8093').should('eq', false);
  });

  it('exposes health checks only on started env sites', () => {
    cy.request('http://localhost:8090/__health__').its('body.status').should('eq', 'ok');
    cy.request('http://localhost:8092/__health__').its('body.status').should('eq', 'ok');
    cy.task('isPortListening', 'http://localhost:8093/__health__').should('eq', false);
  });
});
