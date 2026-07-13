declare module 'expo-location' {
  export type LocationAccuracy =
    | 1 | 2 | 3 | 4 | 5 | 6;

  export interface LocationObject {
    coords: {
      latitude: number;
      longitude: number;
      altitude: number | null;
      accuracy: number | null;
      altitudeAccuracy: number | null;
      heading: number | null;
      speed: number | null;
    };
    timestamp: number;
  }

  export interface LocationPermissionResponse {
    status: 'granted' | 'denied' | 'undetermined';
    granted: boolean;
    expires: 'never' | number;
    canAskAgain: boolean;
  }

  export const Accuracy: {
    Low: LocationAccuracy;
    Balanced: LocationAccuracy;
    High: LocationAccuracy;
    Highest: LocationAccuracy;
    LowPower: LocationAccuracy;
  };

  export function requestForegroundPermissionsAsync(): Promise<LocationPermissionResponse>;
  export function getCurrentPositionAsync(options?: {
    accuracy?: LocationAccuracy;
    timeInterval?: number;
  }): Promise<LocationObject>;
}
