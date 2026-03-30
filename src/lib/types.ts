export interface Court {
  id: string;
  name: string;
  address: string;
  baskets: number;
  setting: string;
  accessType: string;
  latitude: number;
  longitude: number;
  currentUsers: number;
  activeUserIds: string[];
  hasLights: boolean;
  hoursOfOperation: string;
  courtCondition: string;
  threePointLine: string;
  goatsTake: string;
  photoUrl: string;
  photoUrlCard: string;
  photoUrlFull: string;
  phoneNumber: string;
}
