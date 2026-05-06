"use client";

interface SvgPreviewProps {
  title: string;
  subtitle?: string;
  svgContent: string | null;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyText?: string;
  variant?: 'default' | 'generated';
}

export function SvgPreview({
  title, subtitle, svgContent,
  isLoading = false, error = null,
  onRetry, emptyText = '暂无内容', variant = 'default',
}: SvgPreviewProps) {
  return (
    <div className={`svg-preview${variant === 'generated' ? ' generated' : ''}`}>
      <div className="preview-header">
        <h3>{title}</h3>
        {subtitle && <span className="preview-subtitle">{subtitle}</span>}
      </div>
      <div className="preview-container">
        {isLoading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <span>处理中...</span>
          </div>
        ) : error ? (
          <div className="error-state">
            <span className="error-icon">!</span>
            <p>{error}</p>
            {onRetry && <button className="retry-btn" onClick={onRetry}>重试</button>}
          </div>
        ) : svgContent ? (
          <div className="svg-render" dangerouslySetInnerHTML={{ __html: svgContent }} />
        ) : (
          <div className="empty-state">{emptyText}</div>
        )}
      </div>
    </div>
  );
}
