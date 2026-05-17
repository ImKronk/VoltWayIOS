// Connector-aware filtering. Profile connector values are normalised
// (CCS2 / CHAdeMO / Type 2 / Tesla), but OCM connector titles vary
// ("CCS (Type 2)", "Mennekes (Type 2)", "Tesla Supercharger", ...).
// Ported verbatim from the web app's stationSupportsConnector().
export function stationSupportsConnector(station, userConnector) {
  if (!userConnector) return true;
  if (!station.connectors || !station.connectors.length) return false;
  const u = userConnector.toLowerCase();
  return station.connectors.some((raw) => {
    const c = (raw || '').toLowerCase();
    if (u === 'ccs2') return c.includes('ccs') || c.includes('combo');
    if (u === 'chademo') return c.includes('chademo');
    // Pure Type 2 — exclude "CCS (Type 2)" / combo entries which need a CCS plug.
    if (u === 'type 2') {
      return (
        (c.includes('type 2') || c.includes('mennekes')) &&
        !c.includes('ccs') &&
        !c.includes('combo')
      );
    }
    if (u === 'tesla') return c.includes('tesla');
    return c.includes(u);
  });
}
