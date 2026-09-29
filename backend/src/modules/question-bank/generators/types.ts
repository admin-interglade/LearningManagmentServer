export type Complexity = 'low' | 'medium' | 'high';

export interface GeneratedQuestion {
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string | null;
  sourceQuestionId?: string | null;
}
