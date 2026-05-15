export interface AirportData {
  code: string;
  address: string;
  city: string;
  country: string;
}

export const AIRPORTS: Record<string, AirportData> = {
  'TOKYO HANEDA': {
    code: 'HND',
    address: 'Haneda Airport, Ota City, Tokyo, Japan',
    city: 'Tokyo',
    country: 'Japan',
  },
  'TOKYO NARITA': {
    code: 'NRT',
    address: 'Narita International Airport, Narita, Chiba, Japan',
    city: 'Tokyo',
    country: 'Japan',
  },
  'OSAKA KANSAI': {
    code: 'KIX',
    address: 'Kansai International Airport, Izumisano, Osaka, Japan',
    city: 'Osaka',
    country: 'Japan',
  },
  'OSAKA ITAMI': {
    code: 'ITM',
    address: 'Osaka International Airport, Itami, Hyogo, Japan',
    city: 'Osaka',
    country: 'Japan',
  },
  'FUKUOKA': {
    code: 'FUK',
    address: 'Fukuoka Airport, Fukuoka, Japan',
    city: 'Fukuoka',
    country: 'Japan',
  },
  'SAPPORO CHITOSE': {
    code: 'CTS',
    address: 'New Chitose Airport, Chitose, Hokkaido, Japan',
    city: 'Sapporo',
    country: 'Japan',
  },
  'NAGOYA CENTRAIR': {
    code: 'NGO',
    address: 'Chubu Centrair International Airport, Tokoname, Aichi, Japan',
    city: 'Nagoya',
    country: 'Japan',
  },
  'SEOUL GIMPO': {
    code: 'GMP',
    address: 'Gimpo International Airport, Seoul, South Korea',
    city: 'Seoul',
    country: 'South Korea',
  },
  'SEOUL INCHEON': {
    code: 'ICN',
    address: 'Incheon International Airport, Incheon, South Korea',
    city: 'Seoul',
    country: 'South Korea',
  },
  'BUSAN': {
    code: 'PUS',
    address: 'Gimhae International Airport, Busan, South Korea',
    city: 'Busan',
    country: 'South Korea',
  },
};

export const AIRLINE_NAMES: Record<string, string> = {
  JL: 'Japan Airlines',
  NH: 'ANA',
  KE: 'Korean Air',
  OZ: 'Asiana Airlines',
  ZE: 'Eastar Jet',
  TW: "T'way Air",
  LJ: 'Jin Air',
  BX: 'Air Busan',
  '7C': 'Jeju Air',
  MM: 'Peach Aviation',
  GK: 'Jetstar Japan',
};
