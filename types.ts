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

// API 协议草案（后续接入后端时使用）
export interface GenerateRequest {
  // 输入文本（可选，用于文本转矢量）
  text?: string;
  // 基于某个示例生成
  baseExampleId?: string;
  // 生成风格
  style?: 'kaishu' | 'xingshu';
}

export interface GenerateResponse {
  // 生成的 SVG 文本
  svgContent: string;
  // 生成耗时（毫秒）
  processingTime: number;
  // 生成 ID
  generationId: string;
}
