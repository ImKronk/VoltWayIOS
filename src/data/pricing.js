// Reference pricing for Portuguese operators + fallback station data.
// OCM rarely carries a numeric EUR/kWh for PT stations; these are
// published reference rates (operator websites + Mobi.E). NOT real-time.
// Tier picked by speed: <43 kW -> AC tariff, >=43 kW -> DC fast tariff.
export const OPERATOR_PRICING = {
  'Mobie.pt': { ac: 0.3, dc: 0.45, src: 'Mobi.E — tarifa media via CEME (EDP Comercial)', url: 'https://www.mobie.pt' },
  EDP: { ac: 0.3, dc: 0.45, src: 'EDP Comercial — tarifario publico', url: 'https://www.edp.pt/particulares/servicos/mobilidade-eletrica/' },
  'GALP Electric': { ac: 0.32, dc: 0.45, src: 'Galp Mobilidade Eletrica — tarifario publico', url: 'https://galp.com/pt/particulares/eletrico/carregamento' },
  'PowerDot (Es)': { ac: 0.4, dc: 0.49, src: 'PowerDot — tabela publica', url: 'https://power-dot.com/pt/' },
  'Tesla (Tesla-only charging)': { ac: null, dc: 0.4, src: 'Tesla Supercharger PT — valores Tesla.com', url: 'https://www.tesla.com/pt_PT/findus' },
  'Repsol - Ibil (ES)': { ac: 0.32, dc: 0.49, src: 'Repsol Waylet — tarifario publico', url: 'https://www.repsol.pt' },
  PRIOE: { ac: 0.3, dc: 0.39, src: 'PRIO E.charge — tarifario publico', url: 'https://www.prio.pt/eletricos' },
  'Continente Plug&Charge': { ac: 0.0, dc: null, src: 'Continente (Sonae) — gratuito durante compras', url: 'https://www.continente.pt' },
  'EVIO (PT)': { ac: null, dc: null, src: 'EVIO — privado/condominios; tarifa do proprietario', url: 'https://evio.pt' },
  'Maksu (PT)': { ac: null, dc: null, src: 'tarifa definida pelo proprietario do local', url: null },
  'eVaz Energy (PT)': { ac: null, dc: null, src: 'tarifa definida pelo proprietario do local', url: null },
  '(Business Owner at Location)': { ac: null, dc: null, src: 'tarifa definida pelo proprietario do local', url: null },
};

// Returns { eur, src, url, tier } when a reference rate exists, else null.
export function referencePrice(station) {
  if (!station.operator) return null;
  const entry = OPERATOR_PRICING[station.operator];
  if (!entry) return null;
  const tier = station.speed != null && station.speed >= 43 ? 'dc' : 'ac';
  const eur = entry[tier];
  if (eur == null) return { eur: null, src: entry.src, url: entry.url, tier };
  return { eur, src: entry.src, url: entry.url, tier };
}

// Used only if both OCM and Supabase are unavailable.
export const fallbackStations = [
  { id: 1, name: 'EcoCharge Bastille', addr: '42 Rue de la Roquette, Paris', lat: 48.8534, lng: 2.3725, status: 'available', price: 0.35, speed: 50, chargers: 4, dist: '350m', pred: 92, wait: 0, connectors: ['CCS (Type 2)', 'Type 2'] },
  { id: 2, name: 'ChargePoint Opera', addr: '8 Blvd des Capucines, Paris', lat: 48.871, lng: 2.331, status: 'available', price: 0.42, speed: 150, chargers: 6, dist: '1.2km', pred: 75, wait: 8, connectors: ['CCS (Type 2)'] },
  { id: 3, name: 'TotalEnergies Gare de Lyon', addr: 'Gare de Lyon, Paris', lat: 48.8443, lng: 2.3735, status: 'occupied', price: 0.38, speed: 50, chargers: 3, dist: '800m', pred: 58, wait: 12, connectors: ['Type 2', 'CHAdeMO'] },
  { id: 4, name: 'Ionity Peripherique', addr: 'Porte de Vincennes, Paris', lat: 48.8472, lng: 2.41, status: 'occupied', price: 0.79, speed: 350, chargers: 8, dist: '3.5km', pred: 35, wait: 25, connectors: ['CCS (Type 2)'] },
  { id: 5, name: 'Belib Marais', addr: '14 Rue des Archives, Paris', lat: 48.858, lng: 2.356, status: 'available', price: 0.25, speed: 22, chargers: 2, dist: '600m', pred: 88, wait: 0, connectors: ['Type 2'] },
  { id: 6, name: 'Shell Recharge Republique', addr: 'Place de la Republique, Paris', lat: 48.8676, lng: 2.3637, status: 'unknown', price: 0.45, speed: 75, chargers: 4, dist: '1.5km', pred: 62, wait: 5, connectors: ['CCS (Type 2)', 'CHAdeMO'] },
  { id: 7, name: 'Fastned A4', addr: 'Autoroute A4, Charenton', lat: 48.822, lng: 2.405, status: 'available', price: 0.59, speed: 300, chargers: 6, dist: '5.2km', pred: 95, wait: 0, connectors: ['CCS (Type 2)'] },
  { id: 8, name: 'EVBox Nation', addr: 'Place de la Nation, Paris', lat: 48.8489, lng: 2.396, status: 'occupied', price: 0.32, speed: 50, chargers: 3, dist: '2.1km', pred: 45, wait: 18, connectors: ['Type 2'] },
];
