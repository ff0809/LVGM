"use client";

import { SvgInfo } from '@/lib/types';

interface InfoCardProps {
  info: SvgInfo | null;
  title?: string;
}

export function InfoCard({ info, title = 'SVG 信息' }: InfoCardProps) {
  if (!info) {
    return (
      <div className="info-card">
        <h4>{title}</h4>
        <p className="no-info">请先选择一个示例</p>
      </div>
    );
  }

  return (
    <div className="info-card">
      <h4>{title}</h4>
      <div className="info-grid">
        <div className="info-item">
          <span className="info-label">文件名</span>
          <span className="info-value">{info.fileName}</span>
        </div>
        <div className="info-item">
          <span className="info-label">viewBox</span>
          <span className="info-value">{info.viewBox || '未设置'}</span>
        </div>
        <div className="info-item">
          <span className="info-label">尺寸</span>
          <span className="info-value">
            {info.width && info.height
              ? `${info.width} x ${info.height}`
              : '未指定'}
          </span>
        </div>
        <div className="info-item">
          <span className="info-label">Path 数量</span>
          <span className="info-value">{info.pathCount}</span>
        </div>
        <div className="info-item">
          <span className="info-label">元素总数</span>
          <span className="info-value">{info.elementCount}</span>
        </div>
        <div className="info-item">
          <span className="info-label">包含 Style</span>
          <span className="info-value">{info.hasStyle ? '是' : '否'}</span>
        </div>
      </div>
    </div>
  );
}
