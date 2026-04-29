"use client";

interface SvgPreviewProps {
  title: string;
  svgContent: string | null;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyText?: string;
}

export function SvgPreview({
  title,
  svgContent,
  isLoading = false,
  error = null,
  onRetry,
  emptyText = '暂无内容',
}: SvgPreviewProps) {
  return (
    <div className="svg-preview">
      <h3>{title}</h3>
      <div className="preview-container">
        {isLoading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <span>加载中...</span>
          </div>
        ) : error ? (
          <div className="error-state">
            <span className="error-icon">!</span>
            <p>{error}</p>
            {onRetry && (
              <button className="retry-btn" onClick={onRetry}>
                重试
              </button>
            )}
          </div>
        ) : svgContent ? (
          <div
            className="svg-render"
            dangerouslySetInnerHTML={{ __html: svgContent }}
          />
        ) : (
          <div className="empty-state">{emptyText}</div>
        )}
      </div>
    </div>
  );
}
