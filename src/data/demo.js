// Demo / illustrative data for the Leaderboard, Predictions and Battery
// screens. The web app hard-codes these too — they are clearly labelled
// as estimates / demo data in the UI.

// ─── Leaderboard ───
export const LEADERBOARD = [
  { rank: 1, initials: 'ET', color: '#395B64', name: 'EVExplorerTom', badge: 'EV Expert', pts: 3280, emoji: '🏆', tier: 'gold' },
  { rank: 2, initials: 'GM', color: '#2C3333', name: 'GreenDriverMia', badge: 'Helper', pts: 2750, emoji: '⭐', tier: 'silver' },
  { rank: 3, initials: 'CL', color: '#A5C9CA', name: 'ChargeMasterLeo', badge: 'Explorer', pts: 2490, emoji: '🌿', tier: 'bronze' },
  { rank: 4, initials: 'EZ', color: '#6B8E8E', name: 'EcoTravelerZoe', badge: 'Explorer', pts: 2200, emoji: '🌱', tier: null },
  { rank: 5, initials: 'EA', color: '#E7F6F2', name: 'ElectricAlex', badge: 'Explorer', pts: 1980, emoji: '🔋', tier: null, darkText: true },
];

export const MY_STATS = {
  rank: '#12',
  points: 1750,
  updatesSubmitted: 32,
  confirmedAccurate: 28,
  bonusPoints: 150,
};

export const LEVEL = {
  title: 'Helper Nível 2',
  points: 1750,
  progressPct: 87.5,
  nextPts: 2000,
  nextLabel: 'EV Expert',
};

// ─── AI Predictions ───
export const PREDICTIONS = [
  { name: 'EcoCharge Bastille', addr: '42 Rue de la Roquette', prob: 92, cls: 'high', wait: '0 min', txt: 'Provavelmente livre agora' },
  { name: 'ChargePoint Opera', addr: '8 Blvd des Capucines', prob: 75, cls: 'medium', wait: '~8 min', txt: '75% de hipotese em 20 min' },
  { name: 'Ionity Peripherique', addr: 'Porte de Vincennes', prob: 35, cls: 'low', wait: '~25 min', txt: 'Provavelmente ocupado' },
  { name: 'TotalEnergies Gare', addr: 'Gare de Lyon', prob: 58, cls: 'medium', wait: '~12 min', txt: 'Talvez livre em 15 min' },
];

export const HOURLY_FORECAST = {
  labels: ['6', '8', '9', '10', '12', '14', '16', '17', '18', '19', '20', '22'],
  data: [15, 22, 40, 55, 48, 62, 88, 95, 78, 52, 30, 18],
};

// ─── Battery & Range ───
export const BATTERY = {
  level: 65,
  stats: [
    { val: '187 km', label: 'Autonomia Est.' },
    { val: '15.2 kWh', label: 'Consumo Medio' },
    { val: '22°C', label: 'Temperatura' },
  ],
  consumption: [16.2, 15.8, 14.5, 15.1, 16.8, 14.9, 13.8, 15.4, 14.2, 13.5],
  consumptionLabels: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom', 'Seg', 'Ter', 'Qua'],
  driving: [
    { label: 'Velocidade Media', pct: 65, val: '62 km/h', color: '#395B64' },
    { label: 'Eficiencia', pct: 78, val: '78%', color: '#2C3333' },
    { label: 'Travagem Regen.', pct: 45, val: '45%', color: '#A5C9CA' },
  ],
};

// ─── Community / Reports ───
export const COMMUNITY_STATS = { updatesToday: 1247, accuracy: 89 };

export const RECENT_REPORTS = [
  { initial: 'M', name: 'Marie D.', station: 'ChargePoint Opera', statusEmoji: '🟢', time: 'há 2 min' },
  { initial: 'P', name: 'Pierre L.', station: 'TotalEnergies', statusEmoji: '🔴', time: 'há 5 min' },
  { initial: 'S', name: 'Sophie R.', station: 'Ionity A6', statusEmoji: '⚪', time: 'há 12 min' },
];
