// Data lifted verbatim from united-carriers.netlify.app/chunks/my-flights-*.js
// (their lat/lng values are deliberately nudged off true airport coordinates so
//  the pins land cleanly on the dot grid — kept as-is for a 1:1 match)

import CHENNAI_PROJECTION from './chennai-projection.json';

export const WORLD_AIRPORTS = {
  type: 'AirportsCollection',
  airports: [
    { text: 'LHR', size: 1, country: 'UK',           city: 'London',        lat: '53.8085',  lng: '-2.7597'   },
    { text: 'FRA', size: 1, country: 'Germany',      city: 'Frankfurt',     lat: '51.0774',  lng: '10.2704'   },
    { text: 'MAD', size: 1, country: 'Spain',        city: 'Madrid',        lat: '40.3207',  lng: '-3.6242'   },
    { text: 'FCO', size: 1, country: 'Italy',        city: 'Rome',          lat: '42.6708',  lng: '12.2690'   },
    { text: 'IST', size: 1, country: 'Turkey',       city: 'Istanbul',      lat: '39.1451',  lng: '35.1172'   },
    { text: 'TLV', size: 1, country: 'Israel',       city: 'Tel Aviv',      lat: '31.4791',  lng: '35.0010'   },
    { text: 'CAI', size: 1, country: 'Egypt',        city: 'Cairo',         lat: '26.4749',  lng: '29.8610'   },
    { text: 'DOH', size: 1, country: 'Qatar',        city: 'Doha',          lat: '25.3210',  lng: '51.1838'   },
    { text: 'RUH', size: 1, country: 'Saudi Arabia', city: 'Riyadh',        lat: '19.0893',  lng: '44.6413'   },
    { text: 'NBO', size: 1, country: 'Kenya',        city: 'Nairobi',       lat: '0.5955',   lng: '37.7914'   },
    { text: 'CPT', size: 1, country: 'South Africa', city: 'Cape Town',     lat: '-28.9233', lng: '25.1581'   },
    { text: 'JFK', size: 1, country: 'USA',          city: 'New York',      lat: '44.7557',  lng: '-103.5725' },
    { text: 'YYZ', size: 1, country: 'Canada',       city: 'Toronto',       lat: '60.4769',  lng: '-96.3960'  },
    { text: 'MEX', size: 1, country: 'Mexico',       city: 'Mexico City',   lat: '23.9134',  lng: '-102.2231' },
    { text: 'GRU', size: 1, country: 'Brazil',       city: 'Sao Paulo',     lat: '-10.6555', lng: '-53.1725'  },
    { text: 'EZE', size: 1, country: 'Argentina',    city: 'Buenos Aires',  lat: '-34.7366', lng: '-64.7543'  },
    { text: 'BOG', size: 1, country: 'Colombia',     city: 'Bogota',        lat: '3.9163',   lng: '-73.0735'  },
    { text: 'SCL', size: 1, country: 'Chile',        city: 'Santiago',      lat: '-43.3109', lng: '-74.1779'  },
    { text: 'NRT', size: 1, country: 'Japan',        city: 'Tokyo',         lat: '37.5367',  lng: '137.7123'  },
    { text: 'HKG', size: 1, country: 'Hong Kong',    city: 'Hong Kong',     lat: '22.3080',  lng: '113.9185'  },
    { text: 'BKK', size: 1, country: 'Thailand',     city: 'Bangkok',       lat: '14.9807',  lng: '101.0025'  },
    { text: 'SIN', size: 1, country: 'Singapore',    city: 'Singapore',     lat: '1.3644',   lng: '103.9915'  },
    { text: 'SYD', size: 1, country: 'Australia',    city: 'Sydney',        lat: '-25.7631', lng: '134.3141'  },
    { text: 'AKL', size: 1, country: 'New Zealand',  city: 'Auckland',      lat: '-41.5511', lng: '172.9514'  },
    { text: 'PEK', size: 1, country: 'China',        city: 'Beijing',       lat: '36.6834',  lng: '103.4525'  },
  ],
};

export const WORLD_FLIGHTS = {
  type: 'FlightsCollection',
  flights: [
    { from: 'YYZ', to: 'CPT', status: false, startLat: 60.4769, startLng: -96.396,   endLat: -28.9233, endLng: 25.1581,  arcAlt: 0.3 },
    { from: 'YYZ', to: 'NBO', status: true,  startLat: 60.4769, startLng: -96.396,   endLat: 0.5955,   endLng: 37.7914,  arcAlt: 0.3 },
    { from: 'MEX', to: 'LHR', status: true,  startLat: 23.9134, startLng: -102.2231, endLat: 53.8085,  endLng: -2.7597,  arcAlt: 0.3 },
    { from: 'JFK', to: 'MAD', status: true,  startLat: 44.7557, startLng: -103.5725, endLat: 40.3207,  endLng: -3.6242,  arcAlt: 0.3 },
    { from: 'BOG', to: 'CAI', status: true,  startLat: 3.9163,  startLng: -73.0735,  endLat: 26.4749,  endLng: 29.861,   arcAlt: 0.3 },
    { from: 'BOG', to: 'AKL', status: true,  startLat: 3.9163,  startLng: -73.0735,  endLat: -41.5511, endLng: 172.9514, arcAlt: 0.3 },
    { from: 'MEX', to: 'MAD', status: true,  startLat: 23.9134, startLng: -102.2231, endLat: 40.3207,  endLng: -3.6242,  arcAlt: 0.3 },
    { from: 'EZE', to: 'FCO', status: true,  startLat: -34.7366, startLng: -64.7543, endLat: 42.6708,  endLng: 12.269,   arcAlt: 0.3 },
    { from: 'FCO', to: 'NRT', status: true,  startLat: 42.6708, startLng: 12.269,    endLat: 37.5367,  endLng: 137.7123, arcAlt: 0.3 },
    { from: 'SCL', to: 'IST', status: true,  startLat: -43.3109, startLng: -74.1779, endLat: 39.1451,  endLng: 35.1172,  arcAlt: 0.3 },
    { from: 'EZE', to: 'SIN', status: true,  startLat: -34.7366, startLng: -64.7543, endLat: 1.3644,   endLng: 103.9915, arcAlt: 0.3 },
    { from: 'SCL', to: 'EZE', status: true,  startLat: -43.3109, startLng: -74.1779, endLat: -34.7366, endLng: -64.7543, arcAlt: 0.3 },
    { from: 'SCL', to: 'JFK', status: true,  startLat: -43.3109, startLng: -74.1779, endLat: 44.7557,  endLng: -103.5725, arcAlt: 0.3 },
    { from: 'JFK', to: 'MEX', status: false, startLat: 44.7557, startLng: -103.5725, endLat: 23.9134,  endLng: -102.2231, arcAlt: 0.3 },
    { from: 'FRA', to: 'GRU', status: false, startLat: 51.0774, startLng: 10.2704,   endLat: -10.6555, endLng: -53.1725, arcAlt: 0.3 },
    { from: 'MAD', to: 'BKK', status: true,  startLat: 40.3207, startLng: -3.6242,   endLat: 14.9807,  endLng: 101.0025, arcAlt: 0.3 },
    { from: 'LHR', to: 'NBO', status: false, startLat: 53.8085, startLng: -2.7597,   endLat: 0.5955,   endLng: 37.7914,  arcAlt: 0.3 },
    { from: 'MAD', to: 'HKG', status: true,  startLat: 40.3207, startLng: -3.6242,   endLat: 22.308,   endLng: 113.9185, arcAlt: 0.3 },
    { from: 'FRA', to: 'HKG', status: false, startLat: 51.0774, startLng: 10.2704,   endLat: 22.308,   endLng: 113.9185, arcAlt: 0.3 },
    { from: 'FRA', to: 'MAD', status: false, startLat: 51.0774, startLng: 10.2704,   endLat: 40.3207,  endLng: -3.6242,  arcAlt: 0.3 },
  ],
};

// ---------------------------------------------------------------------------
// INDIA MAP (previous version, kept so it can be switched back on)
// Use INDIA_AIRPORTS / INDIA_FLIGHTS / INDIA_SEA_LABELS with INDIA_MAP below.
// `country` is what the label chip shows, so it holds the city name here;
// `align` nudges a chip left/right where two cities sit side by side;
// `minor` places keep their pin but hide the name on phones.
// ---------------------------------------------------------------------------
const city = (text, name, lat, lng, opts = {}) => ({
  text, size: 1, country: name, city: name, lat: String(lat), lng: String(lng),
  ...(typeof opts === 'string' ? { align: opts } : opts),
});

export const INDIA_AIRPORTS = {
  type: 'AirportsCollection',
  airports: [
    city('DEL', 'Delhi',     28.61, 77.21),
    city('BOM', 'Mumbai',    19.08, 72.88),
    city('BLR', 'Bengaluru', 12.97, 77.59, 'left'),
    city('MAA', 'Chennai',   13.08, 80.27, 'right'),
    city('CCU', 'Kolkata',   22.57, 88.36),
    city('HYD', 'Hyderabad', 17.39, 78.49),
    city('AMD', 'Ahmedabad', 23.02, 72.57),
    city('GAU', 'Guwahati',  26.14, 91.74),
    city('COK', 'Kochi',      9.93, 76.27),
    city('SXR', 'Srinagar',  34.08, 74.80),
    city('LKO', 'Lucknow',   26.85, 80.95),
  ],
};

const INDIA_AP = Object.fromEntries(INDIA_AIRPORTS.airports.map((a) => [a.text, a]));
const routeIn = (places) => (from, to) => ({
  startLat: +places[from].lat, startLng: +places[from].lng,
  endLat: +places[to].lat, endLng: +places[to].lng, status: true,
});
const route = routeIn(INDIA_AP);

export const INDIA_FLIGHTS = {
  type: 'FlightsCollection',
  flights: [
    route('DEL', 'BOM'),
    route('BOM', 'BLR'),
    route('DEL', 'CCU'),
    route('CCU', 'GAU'),
    route('BLR', 'CCU'),
    route('HYD', 'DEL'),
    route('AMD', 'MAA'),
    route('MAA', 'CCU'),
    route('COK', 'DEL'),
    route('SXR', 'DEL'),
    route('LKO', 'BOM'),
    route('BOM', 'HYD'),
  ],
};

// sea names, drawn as plain text on the globe (no pin)
export const INDIA_SEA_LABELS = [
  { text: 'Arabian Sea',   lat: 15.5, lng: 66.5 },
  { text: 'Bay of Bengal', lat: 15.5, lng: 88.5 },
  { text: 'Indian Ocean',  lat: 2.0,  lng: 78.0 },
];

// map + framing options for the India version (spread into OPTS to use it,
// and restore the INDIA MAP FRAMING css)
export const INDIA_MAP = {
  map: '/data/india-map.json',
  mapProjection: null,
  mapLayers: [
    { name: 'ocean',   color: '#00C757', size: 0.0034, opacity: 0.3 },
    { name: 'fill',    color: '#3ee88a', size: 0.0040, opacity: 0.75 },
    { name: 'rivers',  color: '#5eead4', size: 0.0030, opacity: 0.9 },
    { name: 'states',  color: '#e6fff0', size: 0.0026, opacity: 0.55 },
    { name: 'outline', color: '#e6fff0', size: 0.0042, opacity: 1 },
  ],
  pinSize: 0.0035,
  globeRotationX: 0.384,
  initialPhi: 3.30,
  sway: { amplitude: 0.05, period: 18000 },
};

// ---------------------------------------------------------------------------
// CHENNAI-ONLY MAP — active rider coverage globe
// Chennai only — the Chennai Metropolitan Area — wrapped all the way round
// the globe (see
// scripts/build-chennai-map.py): north-to-south runs round the globe (north
// points right), inland is up and the Bay of Bengal is down, so the globe
// spins a full turn like the world globe with Chennai on every side.
// Coordinates are OpenStreetMap place nodes (stations / airport: the site).
// Major places get a name chip; `minor` ones a smaller plain name (hidden on
// phones). Names that would overlap a higher-priority one are hidden
// automatically while the globe turns.
// ---------------------------------------------------------------------------
const major = (text, name, lat, lng, align) => city(text, name, lat, lng, align ? { align } : {});
const minor = (text, name, lat, lng) => ({ ...city(text, name, lat, lng, { minor: true }), size: 0.6 });

export const CHENNAI_PLACES = {
  type: 'AirportsCollection',
  airports: [
    // --- major (drawn first, never hidden by minor names) ---
    major('MAS', 'Chennai Central', 13.0829, 80.2750, 'right'),
    major('MRN', 'Marina Beach',    13.0500, 80.2824, 'right'),
    major('TNG', 'T. Nagar',        13.0418, 80.2341, 'left'),
    major('ANR', 'Anna Nagar',      13.0882, 80.2073, 'left'),
    major('ADY', 'Adyar',           13.0065, 80.2578),
    major('GDY', 'Guindy',          13.0087, 80.2204, 'left'),
    major('MAA', 'Airport',         12.9900, 80.1693),
    major('VLC', 'Velachery',       12.9791, 80.2209),
    major('KYB', 'Koyambedu',       13.0715, 80.1998),
    major('EGM', 'Egmore',          13.0728, 80.2577),
    major('MYL', 'Mylapore',        13.0316, 80.2700),
    major('POR', 'Porur',           13.0325, 80.1583),
    major('SHO', 'Sholinganallur',  12.8935, 80.2321),
    major('AMB', 'Ambattur',        13.1056, 80.1640),
    major('TBM', 'Tambaram',        12.9246, 80.1173),
    major('AVD', 'Avadi',           13.1147, 80.0997),
    major('PER', 'Perambur',        13.1121, 80.2450),
    major('TVT', 'Tiruvottiyur',    13.1566, 80.3007),
    // --- minor ---
    minor('NGB', 'Nungambakkam',    13.0621, 80.2405),
    minor('KDB', 'Kodambakkam',     13.0492, 80.2243),
    minor('VDP', 'Vadapalani',      13.0503, 80.2118),
    minor('ASN', 'Ashok Nagar',     13.0359, 80.2146),
    minor('KKN', 'K.K. Nagar',      13.0408, 80.2030),
    minor('SDP', 'Saidapet',        13.0208, 80.2240),
    minor('TYP', 'Teynampet',       13.0443, 80.2498),
    minor('ALW', 'Alwarpet',        13.0339, 80.2545),
    minor('RYT', 'Royapettah',      13.0555, 80.2640),
    minor('TPC', 'Triplicane',      13.0604, 80.2751),
    minor('GTN', 'George Town',     13.0921, 80.2822),
    minor('WSP', 'Washermanpet',    13.1136, 80.2815),
    minor('TDP', 'Tondiarpet',      13.1278, 80.2896),
    minor('RYP', 'Royapuram',       13.1146, 80.2940),
    minor('KLT', 'Kolathur',        13.1237, 80.2129),
    minor('VLV', 'Villivakkam',     13.1040, 80.2090),
    minor('KPK', 'Kilpauk',         13.0832, 80.2380),
    minor('PWK', 'Purasawalkam',    13.0893, 80.2550),
    minor('AMJ', 'Aminjikarai',     13.0721, 80.2205),
    minor('MGP', 'Mogappair',       13.0835, 80.1841),
    minor('VLS', 'Valasaravakkam',  13.0430, 80.1752),
    minor('VRG', 'Virugambakkam',   13.0523, 80.1917),
    minor('BSN', 'Besant Nagar',    12.9997, 80.2682),
    minor('TVM', 'Thiruvanmiyur',   12.9859, 80.2644),
    minor('IIT', 'IIT Madras',      12.9916, 80.2336),
    minor('KTP', 'Kotturpuram',     13.0194, 80.2436),
    minor('PRG', 'Perungudi',       12.9710, 80.2418),
    minor('TRP', 'Thoraipakkam',    12.9492, 80.2407),
    minor('NLK', 'Neelankarai',     12.9455, 80.2575),
    minor('PLK', 'Pallikaranai',    12.9305, 80.2078),
    minor('MDP', 'Madipakkam',      12.9611, 80.2001),
    minor('NGN', 'Nanganallur',     12.9801, 80.1849),
    minor('STM', 'St. Thomas Mount', 13.0060, 80.1967),
    minor('KRT', 'Korattur',        13.1115, 80.1846),
    minor('MDV', 'Madhavaram',      13.1421, 80.2324),
    minor('PZL', 'Puzhal',          13.1591, 80.2031),
    minor('MNL', 'Manali',          13.1811, 80.2694),
    minor('ENR', 'Ennore',          13.2258, 80.3244),
    // --- the rest of the Chennai Metropolitan Area ---
    minor('PNM', 'Poonamallee',     13.0417, 80.1007),
    minor('RDH', 'Red Hills',       13.1923, 80.1838),
    minor('PLV', 'Pallavaram',      12.9655, 80.1451),
    minor('CRP', 'Chromepet',       12.9497, 80.1356),
    minor('MDK', 'Medavakkam',      12.9202, 80.1872),
    minor('VDL', 'Vandalur',        12.8921, 80.0830),
    minor('MJR', 'Minjur',          13.2790, 80.2620),
    minor('KDR', 'Kundrathur',      12.9958, 80.0973),
    minor('TVR', 'Thiruverkadu',    13.0705, 80.1239),
    minor('TMZ', 'Thirumazhisai',   13.0540, 80.0608),
    minor('TNV', 'Thiruninravur',   13.1189, 80.0332),
    minor('SLY', 'Selaiyur',        12.9178, 80.1379),
    minor('URP', 'Urapakkam',       12.8637, 80.0722),
    minor('KRP', 'Karapakkam',      12.9117, 80.2277),
    minor('INJ', 'Injambakkam',     12.9189, 80.2513),
    minor('KTV', 'Kathivakkam',     13.2142, 80.3187),
    minor('MDR', 'Maduravoyal',     13.0606, 80.1661),
  ],
};

const CHENNAI_AP = Object.fromEntries(CHENNAI_PLACES.airports.map((a) => [a.text, a]));
const cRoute = routeIn(CHENNAI_AP);

// a hub-and-spoke delivery network between the major places
export const CHENNAI_ROUTES = {
  type: 'FlightsCollection',
  flights: [
    cRoute('MAS', 'TNG'),
    cRoute('MAS', 'ANR'),
    cRoute('MAS', 'TVT'),
    cRoute('TNG', 'ADY'),
    cRoute('TNG', 'POR'),
    cRoute('KYB', 'VLC'),
    cRoute('ANR', 'AMB'),
    cRoute('MAA', 'GDY'),
    cRoute('ADY', 'SHO'),
    cRoute('EGM', 'PER'),
    cRoute('MYL', 'VLC'),
    cRoute('RYP', 'ENR'),
    cRoute('KYB', 'MAA'),
    cRoute('PER', 'MDV'),
    cRoute('GDY', 'TBM'),
    cRoute('KYB', 'AVD'),
    cRoute('AVD', 'TNV'),
    cRoute('AMB', 'RDH'),
    cRoute('RDH', 'MJR'),
    cRoute('MJR', 'ENR'),
    cRoute('ENR', 'TVT'),
    cRoute('POR', 'PNM'),
    cRoute('PNM', 'TMZ'),
    cRoute('POR', 'KDR'),
    cRoute('KDR', 'TBM'),
    cRoute('TBM', 'VDL'),
    cRoute('VDL', 'URP'),
    cRoute('TBM', 'SLY'),
    cRoute('SLY', 'MDK'),
    cRoute('MDK', 'SHO'),
    cRoute('SHO', 'INJ'),
    cRoute('SHO', 'TRP'),
  ],
};

// sea / lake names, drawn as plain text on the globe (no pin)
export const CHENNAI_SEA_LABELS = [
  { text: 'Bay of Bengal', lat: 12.92, lng: 80.285 },
  { text: 'Bay of Bengal', lat: 13.07, lng: 80.315 },
  { text: 'Bay of Bengal', lat: 13.22, lng: 80.355 },
];

// ---------------------------------------------------------------------------
// Active banner: Chennai neighbourhoods distributed around the rotating globe.
// This is a stylized city projection, not a navigation map.
// ---------------------------------------------------------------------------
export const AIRPORTS = CHENNAI_PLACES;
export const FLIGHTS = CHENNAI_ROUTES;
export const SEA_LABELS = CHENNAI_SEA_LABELS;

// Chennai projection keeps the reference globe rendering and banner framing.
export const CHENNAI_MAP = {
  map: '/data/chennai-map.json',
  boundaryMap: '/data/chennai-boundaries.json',
  mapProjection: CHENNAI_PROJECTION,
  mapLayers: [],
  pinSize: 0.0042,
  haloScale: 6,
  arcThickness: 0.0012,
  arcAltBase: 0.006,
  arcAltMultiplier: 0.012,
  maxArcLength: 1.8,
  routeSpeed: 0.004,
  globeRotationX: -0.36,
  initialPhi: 3.8,
  labelFacing: 0.42,       // hide chips a little before the rim so none overlap the glow
};

// Tuning constants — copied from their `E = { ... }` defaults object.
// (the Hero page overrides cameraZ + tileDeg + enableControls per breakpoint)
export const OPTS = {
  pointSize: 0.005,        // exact match to their E config
  tileDeg: 1.2,             // 1.5 on mobile
  edgeColor: '#e6fff0',     // brand: mint-tinted dots (was #ffffff)
  fillColor: '#c6f6d9',     // was #e2e8f0
  fillOpacity: 0.1,
  backOpacity: 0.15,
  pinDotColor: '#00C757',   // brand green (was #F45300)
  arcColor: '#00C757',
  killBack: true,
  pinSize: 0.006,
  pinAltitude: 0.008,
  haloScale: 7.5,
  showArcs: true,
  arcThickness: 0.002,
  arcAltBase: 0.02,
  arcAltMultiplier: 0.01,
  cameraZ: 2.23,           // 2.8 on tablet, 2.7 on mobile
  globeOffsetX: 0,
  globeOffsetY: 0,
  globeScale: 1,
  globeRotationX: 0.15,
  globeRotationZ: 0.05,
  enableControls: true,     // false on mobile
  initialPhi: 3.05,         // India in view at the start, Chennai just left of centre (their 3.8 faced ~52°E)
  spinAxis: 'y',
  labelFacing: 0.05,
  dotShading: 0,            // 0 = even dots like the original globe; up to 1 = lit like a sphere
  autoSpeed: 0.0015,        // rad per 16.666 ms  *  speedMultiplier

  // Base defaults; the Chennai preset below selects local map data.
  map: null,
  mapProjection: null,
  mapLayers: [],
  sway: null,
  ...CHENNAI_MAP,
};
