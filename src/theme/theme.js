// VoltWay design tokens — ported from the web app's styles.css :root vars.
export const colors = {
  c1: '#2C3333',
  c2: '#395B64',
  c3: '#A5C9CA',
  c4: '#E7F6F2',
  navy: '#2C3333',
  navyLight: '#395B64',
  bg: '#E7F6F2',
  card: '#FFFFFF',
  border: '#A5C9CA',
  text: '#2C3333',
  text2: '#395B64',
  text3: '#6B8E8E',
  red: '#e74c3c',
  green: '#2ecc71',
  yellow: '#f1c40f',
  white: '#FFFFFF',
};

export const radius = { lg: 16, md: 12, sm: 8 };

export const shadow = {
  card: {
    shadowColor: '#2C3333',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  lg: {
    shadowColor: '#2C3333',
    shadowOpacity: 0.16,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
};

// Marker colour by station status (matches app.js statusColor()).
export function statusColor(status) {
  if (status === 'available') return colors.green;
  if (status === 'occupied') return colors.red;
  return '#95a5a6'; // unknown / unavailable
}
