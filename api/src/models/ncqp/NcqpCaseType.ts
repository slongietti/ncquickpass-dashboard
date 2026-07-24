/** Case-type metadata; `id` is the `caseTypeId` and `caseTopics` supplies topic ids. */
export interface NcqpCaseType {
  id: number;
  typeName: string;
  caseTopics: { id: number; topicName: string }[];
}
