import { generateTicketCode } from './ticket-code';
describe('generateTicketCode', () => {
  it('uses a readable non-sequential format', () => {
    expect(generateTicketCode()).toMatch(/^TKT-[A-HJ-NP-Z2-9]{6}$/);
  });
});
