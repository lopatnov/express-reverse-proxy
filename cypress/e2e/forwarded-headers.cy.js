describe('Forwarded header sanitization', () => {
  it('reports the real proxy host, not a client-supplied one', () => {
    cy.request('http://localhost:8080/api/echo-headers').then((res) => {
      expect(res.status).to.eq(200);
      expect(res.body.xForwardedHost).to.eq('localhost:8080');
      expect(res.body.xForwardedProto).to.eq('http');
    });
  });

  it('discards a spoofed X-Forwarded-Host instead of relaying it', () => {
    cy.request({
      url: 'http://localhost:8080/api/echo-headers',
      headers: { 'X-Forwarded-Host': 'evil-attacker.com' },
    }).then((res) => {
      expect(res.status).to.eq(200);
      expect(res.body.xForwardedHost).to.eq('localhost:8080');
      expect(res.body.xForwardedHost).not.to.contain('evil-attacker.com');
    });
  });

  it('discards a spoofed X-Forwarded-Proto instead of relaying it', () => {
    cy.request({
      url: 'http://localhost:8080/api/echo-headers',
      headers: { 'X-Forwarded-Proto': 'https' },
    }).then((res) => {
      expect(res.status).to.eq(200);
      expect(res.body.xForwardedProto).to.eq('http');
    });
  });

  it('discards a spoofed X-Forwarded-For, replacing it with the real peer', () => {
    cy.request({
      url: 'http://localhost:8080/api/echo-headers',
      headers: { 'X-Forwarded-For': '203.0.113.9' },
    }).then((res) => {
      expect(res.status).to.eq(200);
      expect(res.body.xForwardedFor)
        .to.be.a('string')
        .and.match(/(^|,\s*)(127\.0\.0\.1|::1|::ffff:127\.0\.0\.1)(,|$)/);
    });
  });

  it('discards a spoofed X-Forwarded-Host even with trustProxy enabled', () => {
    cy.request({
      url: 'http://localhost:8087/api/echo-headers',
      headers: { 'X-Forwarded-Host': 'evil-attacker.com' },
    }).then((res) => {
      expect(res.status).to.eq(200);
      expect(res.body.xForwardedHost).to.eq('localhost:8087');
      expect(res.body.xForwardedHost).not.to.contain('evil-attacker.com');
    });
  });
});
