"use client";

import React, { useState, useRef } from 'react';

interface GenerateResponse {
  success: boolean;
  svg: string;
  gen_time: number;
  gen_tokens: number;
}

const API_URL = 'http://202.120.188.3:21789/api/generate';

export function ApiDemoSection() {
  const [prompt, setPrompt] = useState('不');
  const [given, setGiven] = useState('all');
  const [temperature, setTemperature] = useState(0.9);
  const [topP, setTopP] = useState(0.9);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [svgResult, setSvgResult] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ gen_time: number; gen_tokens: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startProgress = () => {
    setProgress(0);
    progressRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 90) { clearInterval(progressRef.current!); return 90; }
        return p + Math.random() * 4;
      });
    }, 400);
  };

  const stopProgress = () => {
    if (progressRef.current) clearInterval(progressRef.current);
    setProgress(100);
    setTimeout(() => setProgress(0), 600);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsLoading(true);
    setError(null);
    setSvgResult(null);
    setMeta(null);
    startProgress();

    const body: Record<string, unknown> = { prompt: prompt.trim() };
    if (given.trim()) body.given = given.trim();
    if (temperature !== 0.9) body.temperature = temperature;
    if (topP !== 0.9) body.top_p = topP;

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        const detail = data?.detail || `HTTP ${res.status}`;
        throw new Error(friendlyError(detail));
      }

      const d = data as GenerateResponse;
      setSvgResult(d.svg);
      setMeta({ gen_time: d.gen_time, gen_tokens: d.gen_tokens });
    } catch (err) {
      if (err instanceof TypeError && err.message.includes('fetch')) {
        setError('无法连接到推理服务器，请确认服务器已启动或检查网络连接。');
      } else {
        setError(err instanceof Error ? err.message : '未知错误');
      }
    } finally {
      stopProgress();
      setIsLoading(false);
    }
  };

  return (
    <section id="demo" className="content-section">
      <div className="section-label">在线演示</div>
      <h2 className="section-title">
        LVGM 汉字生成演示
        <span className="section-title-en">Interactive Demo</span>
      </h2>
      <p className="section-desc">
        输入汉字，指定已知笔画数量，调用后端大模型实时生成矢量字形。黑色笔画为给定初始笔画，蓝色笔画为模型预测补全。
      </p>

      <div className="api-demo-layout">
        {/* Control Panel */}
        <div className="api-control-panel">
          <div className="api-control-group">
            <label>输入汉字 <span className="api-hint">支持单字或多字，如：不 / 云水</span></label>
            <input
              className="api-input api-input-large"
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="请输入汉字，例如：不"
              onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleGenerate()}
            />
          </div>

          <div className="api-control-group">
            <label>已知笔画 (given) <span className="api-hint">留空则后端自动全给</span></label>
            <div className="given-presets">
              {(['all', '1', '2', '3'].map((v) => (
                <button
                  key={v}
                  className={`given-preset${given === v ? ' active' : ''}`}
                  onClick={() => setGiven(v)}
                >
                  {v === 'all' ? '全给 (all)' : `首 ${v} 笔`}
                </button>
              )))}
            </div>
            <input
              className="api-input"
              type="text"
              value={given}
              onChange={(e) => setGiven(e.target.value)}
              placeholder="all / 1 / all,2"
            />
            <span className="api-hint-block">
              all=全给；1=只给第1笔；all,2=第一字全给、第二字给2笔
            </span>
          </div>

          <div className="advanced-toggle" onClick={() => setShowAdvanced(!showAdvanced)}>
            <span>高级参数</span>
            <span className="adv-arrow">{showAdvanced ? '▲' : '▼'}</span>
          </div>

          {showAdvanced && (
            <div className="advanced-panel">
              <div className="api-control-group">
                <label>Temperature: <strong>{temperature.toFixed(1)}</strong></label>
                <input type="range" min={0.1} max={2.0} step={0.1}
                  value={temperature} onChange={(e) => setTemperature(parseFloat(e.target.value))} />
                <span className="api-hint-block">值越高书法随机性越强（0.1 ~ 2.0）</span>
              </div>
              <div className="api-control-group">
                <label>Top_p: <strong>{topP.toFixed(2)}</strong></label>
                <input type="range" min={0.0} max={1.0} step={0.05}
                  value={topP} onChange={(e) => setTopP(parseFloat(e.target.value))} />
                <span className="api-hint-block">Nucleus 采样阈值（0.0 ~ 1.0）</span>
              </div>
            </div>
          )}

          <button
            className="api-generate-btn"
            onClick={handleGenerate}
            disabled={isLoading || !prompt.trim()}
          >
            {isLoading ? (
              <span className="btn-loading">
                <span className="btn-spinner" />
                推理中...
              </span>
            ) : '生成字形'}
          </button>

          {isLoading && (
            <div className="loading-hint">
              大模型正在推理中，预计需要 3~15 秒，请稍候...
            </div>
          )}

          {meta && !isLoading && (
            <div className="api-meta">
              <div className="api-meta-item">
                <span className="meta-icon">⏱</span>
                <span className="meta-label">推理耗时</span>
                <span className="meta-value">{meta.gen_time.toFixed(2)} 秒</span>
              </div>
              <div className="api-meta-item">
                <span className="meta-icon">◈</span>
                <span className="meta-label">生成 Token</span>
                <span className="meta-value">{meta.gen_tokens}</span>
              </div>
            </div>
          )}
        </div>

        {/* Canvas */}
        <div className="api-canvas-area">
          {isLoading && (
            <div className="api-progress-bar-wrap">
              <div className="api-progress-bar" style={{ width: `${progress}%` }} />
            </div>
          )}

          {error && (
            <div className="api-error-box">
              <span className="error-dot" />
              <span>{error}</span>
            </div>
          )}

          <div className="api-canvas-card">
            {svgResult ? (
              <div className="svg-canvas-inner" dangerouslySetInnerHTML={{ __html: svgResult }} />
            ) : (
              <div className="canvas-placeholder">
                {isLoading ? (
                  <div className="canvas-loading">
                    <div className="canvas-spinner" />
                    <p>模型推理中，请稍候...</p>
                  </div>
                ) : (
                  <div className="canvas-empty">
                    <div className="canvas-grid-icon">字</div>
                    <p>输入汉字后点击「生成字形」</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="canvas-legend">
            <div className="legend-item">
              <span className="legend-dot black" />
              <span>用户给定初始笔画</span>
            </div>
            <div className="legend-item">
              <span className="legend-dot blue" />
              <span>模型预测生成笔画</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function friendlyError(detail: string): string {
  if (detail.includes('not in SVG database')) return '错误：该字符不在 SVG 数据库中';
  if (detail.includes('given has') && detail.includes('chars')) return '错误：given 参数数量与输入字符数不匹配';
  if (detail.includes('not loaded')) return '错误：推理服务尚未就绪，请稍后重试';
  return `错误：${detail}`;
}
