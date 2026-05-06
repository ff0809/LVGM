export interface SvgExample {
  id: string;
  label: string;
  category: 'my_svgs' | 'diffvg';
  svgPath: string;
}

export interface Manifest {
  examples: SvgExample[];
}

export interface SvgInfo {
  fileName: string;
  viewBox: string | null;
  width: string | null;
  height: string | null;
  pathCount: number;
  elementCount: number;
  hasStyle: boolean;
}

export interface GenerateRequest {
  text?: string;
  baseExampleId?: string;
  style?: 'kaishu' | 'xingshu';
}

export interface GenerateResponse {
  svgContent: string;
  processingTime: number;
  generationId: string;
}
