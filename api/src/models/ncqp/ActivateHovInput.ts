import { HovOption } from './HovOption';

/** Body for the HOV activation endpoint. */
export interface ActivateHovInput {
  accountId: string | number;
  transponderNumber: string;
  location: string;
  startDateTime: string;
  endDateTime: string | null;
  createdByUserId: string | number;
  option: HovOption;
}
