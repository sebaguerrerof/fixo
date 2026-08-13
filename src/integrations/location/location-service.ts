export interface Coordinates {
  readonly latitude: number;
  readonly longitude: number;
}

export interface LocationResult extends Coordinates {
  readonly formattedAddress: string;
  readonly city: string;
  readonly region: string;
  readonly country: string;
}

export interface LocationService {
  geocode(address: string): Promise<LocationResult | null>;
}
