// Lightweight Smart Form performance smoke test
// Keeps under 200ms on modest hardware by using in-memory operations only

function formatPlayerName(name: string, team?: string): string {
  return team ? `${name} (${team})` : name;
}

describe('Smart Form view performance', () => {
  it('formats 10k options under 200ms', () => {
    const players = Array.from({ length: 10000 }, (_, i) => ({ name: `Player ${i}`, team: i % 3 === 0 ? 'TEAM' : undefined }));
    const start = Date.now();

    const options = players.map(p => ({
      value: p.name,
      label: formatPlayerName(p.name, p.team),
      metadata: { team: p.team }
    }));

    expect(options.length).toBe(10000);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(200);
  });
});

