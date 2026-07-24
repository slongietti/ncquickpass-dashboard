/** A vehicle/transponder record from the account's vehicle list. */
export interface NcqpVehicleTag {
  vehicleTagNumber?: string;
  tagFriendlyName?: string;
  vehicleTagStatus?: string;
  plateNumber?: string;
  plateStateShortName?: string;
  vehicleMakeName?: string;
  vehicleModelName?: string;
  vehicleYear?: number;
  tagTypeCache?: {
    tagNumber?: string;
    friendlyName?: string;
    tagStatus?: string;
    tag?: { tagNumberValue?: string; tagDisplayNumber?: string };
  };
  [key: string]: unknown;
}
