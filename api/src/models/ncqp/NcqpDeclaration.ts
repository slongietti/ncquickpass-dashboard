/** An HOV declaration as reported by NC Quick Pass. */
export interface NcqpDeclaration {
  declarationId?: string | number;
  accountId?: string | number;
  transponderNumber?: string;
  location?: string;
  status?: string;
  option?: string;
  nickName?: string;
  startDateTime?: string;
  endDateTime?: string;
  [key: string]: unknown;
}
