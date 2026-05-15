export interface AirportInfo {
  name: string;
  code: string;
  address: string;
  city: string;
  country: string;
  terminal?: string;
}

export interface ParsedFlight {
  date: string;
  year: number;
  dateISO: string;
  airline: string;
  airlineName: string;
  flightNumber: string;
  cabin: string;
  from: AirportInfo;
  to: AirportInfo;
  departureTime: string;
  arrivalTime: string;
  departureTimestamp: number;
  arrivalTimestamp: number;
  bookingRef: string;
}

export interface TransitStep {
  mode: 'WALKING' | 'TRANSIT';
  instructions?: string;
  lineName?: string;
  lineColor?: string;
  lineShortName?: string;
  vehicleType?: string;
  departureStop?: string;
  arrivalStop?: string;
  numStops?: number;
  duration: string;
  departureTime?: string;
  arrivalTime?: string;
  distance?: string;
}

export interface TransitRoute {
  status: 'OK' | 'ZERO_RESULTS' | 'ERROR';
  totalDuration: string;
  totalDurationSeconds: number;
  departureTime: string;
  arrivalTime: string;
  steps: TransitStep[];
  googleMapsUrl: string;
}

export interface TripPlan {
  homeAddress: string;
  destAddress: string;
  flight: ParsedFlight;
  departureRoute: TransitRoute | null;
  arrivalRoute: TransitRoute | null;
}
