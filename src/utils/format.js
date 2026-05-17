// Safe formatters for OCM fields that are sometimes missing (null).
export const fmtPrice = (s) => (s && s.price != null ? '€' + s.price.toFixed(2) : 'n/d');
export const fmtSpeed = (s) => (s && s.speed != null ? s.speed + ' kW' : 'n/d');
export const fmtSpeedShort = (s) => (s && s.speed != null ? s.speed + 'kW' : 'n/d');
