"use client";

import { useState, useRef } from 'react';

interface GenerateResult {
  svg: string;
  gen_time: number;
  gen_tokens: number;
}

const QUICK_GIVEN = [
  { label: '智能全给 (all)', value: 'all' },
  { label: '只留首笔 (1)', value: '1' },
  { label: '前两笔 (2)', value: '2' },
];

export function GenerateDemo() {
  const [prompt, setPrompt] = useState('不');
  const [given, setGiven] = useState('all');
  const [temperature, setTemperature] = useState(0.9);
  const [topP, setTopP] = useState(0.9);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<GenerateResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const startFakeProgress = () => {
    setProgress(0);
    let val = 0;
    progressTimer.current = setInterval(() => {
      val += Math.random() * 4 + 1;
      if (val >= 90) { val = 90; if (progressTimer.current) clearInterval(progressTimer.current); }
      setProgress(Math.min(val, 90));
    }, 400);
  };

  const stopProgress = (success: boolean) => {
    if (progressTimer.current) clearInterval(progressTimer.current);
    setProgress(success ? 100 : 0);
  };

  const handleGenerate = async () => {
    const trimmed = prompt.trim();
    if (!trimmed) { setError('请输入要生成的汉字'); return; }
    setError(null);
    setResult(null);
    setLoading(true);
    startFakeProgress();

    try {
      const body: Record<string, unknown> = { prompt: trimmed, temperature, top_p: topP };
      if (given.trim()) body.given = given.trim();

      const res = await fetch('http://202.120.188.3:21789/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        const detail = data?.detail || `请求失败 (${res.status})`;
        // Friendly error messages
        const friendly = detail.includes('not in SVG database')
          ? `该字符不在数据库中：${detail}`
          : detail.includes('given has')
          ? `given 参数与字符数量不匹配：${detail}`
          : detail.includes('not loaded')
          ? '模型尚未加载完毕，请稍后再试'
          : detail;
        throw new Error(friendly);
      }

      if (!data.success) throw new Error(data.detail || '生成失败');
      stopProgress(true);
      setResult({ svg: data.svg, gen_time: data.gen_time, gen_tokens: data.gen_tokens });
    } catch (err: unknown) {
      stopProgress(false);
      const msg = err instanceof TypeError && err.message.includes('fetch')
        ? '无法连接到推理服务器，请检查网络或稍后重试'
        : err instanceof Error ? err.message : '未知错误';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="gen-demo">
      {/* ---- Left: Control Panel ---- */}
      <aside className="gen-panel">
        <div className="gen-panel-title">
          <span className="gen-panel-dot" />
          LVGM 汉字生成系统
        </div>
        <p className="gen-panel-sub">基于深度学习的 SVG 汉字生成与补全</p>

        {/* Prompt */}
        <div className="gen-field">
          <label className="gen-label">输入汉字 <span className="gen-required">*</span></label>
          <input
            className="gen-input gen-input-lg"
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="请输入汉字，例如：不 或 云水"
            disabled={loading}
            onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
          />
        </div>

        {/* Given */}
        <div className="gen-field">
          <label className="gen-label">
            已知笔画 (given)
            <span className="gen-tooltip" title="1 = 只给第1笔；all = 全给；all,2 = 多字一一对应">?</span>
          </label>
          <div className="gen-quick-tabs">
            {QUICK_GIVEN.map((q) => (
              <button
                key={q.value}
                className={`gen-quick-btn${given === q.value ? ' active' : ''}`}
                onClick={() => setGiven(q.value)}
                disabled={loading}
              >
                {q.label}
              </button>
            ))}
          </div>
          <input
            className="gen-input"
            type="text"
            value={given}
            onChange={(e) => setGiven(e.target.value)}
            placeholder="all / 1 / all,2"
            disabled={loading}
          />
          <p className="gen-hint">留空则后端默认为 all；多字可用逗号分隔，如 all,2</p>
        </div>

        {/* Advanced */}
        <button className="gen-advanced-toggle" onClick={() => setShowAdvanced((v) => !v)}>
          {showAdvanced ? '▲' : '▼'} 高级参数
        </button>
        {showAdvanced && (
          <div className="gen-advanced">
            <div className="gen-field">
              <label className="gen-label">Temperature: {temperature.toFixed(1)}</label>
              <input
                type="range" min={0.1} max={2.0} step={0.1}
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
                disabled={loading}
                className="gen-slider"
              />
              <p className="gen-hint">值越高，书法笔画越随机多变</p>
            </div>
            <div className="gen-field">
              <label className="gen-label">Top-p: {topP.toFixed(2)}</label>
              <input
                type="range" min={0.0} max={1.0} step={0.05}
                value={topP}
                onChange={(e) => setTopP(parseFloat(e.target.value))}
                disabled={loading}
                className="gen-slider"
              />
            </div>
          </div>
        )}

        {/* Generate button */}
        <button className="gen-btn" onClick={handleGenerate} disabled={loading}>
          {loading ? (
            <span className="gen-btn-loading">
              <span className="gen-spinner" />
              推理中，请稍候…
            </span>
          ) : '生 成'}
        </button>

        {loading && (
          <div className="gen-progress-wrap">
            <div className="gen-progress-bar" style={{ width: `${progress}%` }} />
            <p className="gen-progress-hint">大模型正在推理，预计需要 3 ~ 15 秒…</p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="gen-error">
            <strong>错误：</strong>{error}
          </div>
        )}
      </aside>

      {/* ---- Right: Canvas Area ---- */}
      <div className="gen-canvas-area">
        {result ? (
          <>
            <div className="gen-canvas-card">
              {/* 米字格背景 + SVG */}
              <div className="gen-grid-bg" dangerouslySetInnerHTML={{ __html: result.svg }} />
            </div>

            {/* Legend */}
            <div className="gen-legend">
              <span className="gen-legend-item">
                <span className="gen-legend-dot" style={{ background: '#111' }} />
                黑色：用户给定笔画
              </span>
              <span className="gen-legend-item">
                <span className="gen-legend-dot" style={{ background: '#3b82f6' }} />
                蓝色：AI 生成笔画
              </span>
            </div>

            {/* Meta */}
            <div className="gen-meta">
              <div className="gen-meta-item">
                <span className="gen-meta-icon">⏱</span>
                <span className="gen-meta-label">推理耗时</span>
                <span className="gen-meta-value">{result.gen_time.toFixed(2)} 秒</span>
              </div>
              <div className="gen-meta-item">
                <span className="gen-meta-icon">🪙</span>
                <span className="gen-meta-label">生成 Token</span>
                <span className="gen-meta-value">{result.gen_tokens}</span>
              </div>
            </div>
          </>
        ) : (
          <div className="gen-empty">
            <div className="gen-empty-grid" />
            <p className="gen-empty-text">
              {loading ? '正在生成，请稍候…' : '在左侧输入汉字，点击「生成」查看结果'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
