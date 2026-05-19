"use client";

import React, { useState } from 'react';

export function ApiDemoSection() {
  const [prompt, setPrompt] = useState('不');
  const [given, setGiven] = useState('1');
  const [temperature, setTemperature] = useState(0.8);
  const [topP, setTopP] = useState(0.9);

  const [loading, setLoading] = useState(false);
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ genTime: number; genTokens: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 快捷键智能逻辑：根据当前 prompt 汉字长度动态拼接 given 格式
  const applyPreset = (type: 'all' | 'all-but-last' | 'only-first') => {
    const len = prompt.trim().length || 1;
    if (type === 'all') {
      setGiven(''); // 留空则不传，完美触发后端多字自动 "all,all..." 机制
    } else if (type === 'all-but-last') {
      if (len <= 1) {
        setGiven('1');
      } else {
        // 前面全给 all，最后一个字给 1 笔。例如 5个字: all,all,all,all,1
        const arr = Array(len - 1).fill('all');
        arr.push('1');
        setGiven(arr.join(','));
      }
    } else if (type === 'only-first') {
      // 所有字都只给第 1 笔。例如 3个字: 1,1,1
      setGiven(Array(len).fill('1').join(','));
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    setErrorMsg(null);
    setSvgContent(null);
    setMeta(null);

    // 严谨过滤输入的空格和空字符
    const cleanPrompt = prompt.trim();
    const cleanGiven = given.trim();

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: cleanPrompt,
          ...(cleanGiven !== '' ? { given: cleanGiven } : {}),
          temperature,
          top_p: topP
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSvgContent(data.svg);
        setMeta({ genTime: data.gen_time, genTokens: data.gen_tokens });
      } else {
        setErrorMsg(data.detail || `请求失败，状态码: ${response.status}`);
      }
    } catch (err: any) {
      setErrorMsg(err.message || '网络连接失败，请检查后端服务是否正常运行。');
    } finally {
      setLoading(false);
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
        输入汉字并指定已知笔画，调用后端大模型实时预测补全字形。黑色为给定初始笔画，蓝色为模型预测生成。
      </p>

      <div className="api-demo-wrapper">
        {/* 左侧控制面板 */}
        <div className="api-demo-controls">
          <div className="control-group">
            <label htmlFor="api-prompt">输入汉字 (prompt)</label>
            <input
              id="api-prompt"
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="请输入汉字，如：不、云水"
              className="custom-input font-bold"
            />
          </div>

          <div className="control-group">
            <label>智能笔画预设 · Smart Presets</label>
            <div className="given-toggle-row">
              <button type="button" onClick={() => applyPreset('all')} className="given-toggle-btn">
                🏛️ 全字给全 (默认)
              </button>
              <button type="button" onClick={() => applyPreset('all-but-last')} className="given-toggle-btn">
                🎯 末字预测 (留1笔)
              </button>
              <button type="button" onClick={() => applyPreset('only-first')} className="given-toggle-btn">
                ✨ 全留首笔 (盲盒)
              </button>
            </div>
            
            <label htmlFor="api-given" style={{ marginTop: '12px' }}>已知笔画值 (given)</label>
            <input
              id="api-given"
              type="text"
              value={given}
              onChange={(e) => setGiven(e.target.value)}
              placeholder="留空则不传此参数"
              className="custom-input font-mono"
            />
            <small className="hint">
              格式：数字代表提供前几笔，多字用逗号隔开（如：all,all,1）。留空则由后端智能分配全给。
            </small>
          </div>

          <div className="api-params-box">
            <h4>高级采样参数</h4>
            <div className="control-group">
              <div className="param-label-row">
                <span>采样温度 (Temperature):</span>
                <strong>{temperature}</strong>
              </div>
              <input
                type="range" min="0.1" max="2.0" step="0.1"
                value={temperature}
                onChange={(e) => setTemperature(parseFloat(e.target.value))}
              />
            </div>
            <div className="control-group">
              <div className="param-label-row">
                <span>Nucleus 采样 (Top_p):</span>
                <strong>{topP}</strong>
              </div>
              <input
                type="range" min="0.0" max="1.0" step="0.05"
                value={topP}
                onChange={(e) => setTopP(parseFloat(e.target.value))}
              />
            </div>
          </div>

          <button className="generate-btn" onClick={handleGenerate} disabled={loading || !prompt.trim()}>
            {loading ? (
              <span className="generate-btn-loading">
                <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, borderTopColor: '#fff' }} />
                模型推理中 (预计 3~15 秒)...
              </span>
            ) : (
              '开始生成笔画'
            )}
          </button>

          {errorMsg && (
            <div className="api-error-box">
              <div className="error-title">⚠️ 出错了：</div>
              {errorMsg}
            </div>
          )}
        </div>

        {/* 右侧画布区域 */}
        <div className="api-demo-canvas">
          <h3>SVG 渲染画布 · Canvas</h3>

          <div className="canvas-container">
            {/* 精致红线米字格 */}
            <div className="mi-zi-ge">
              <div className="mi-zi-ge-h" />
              <div className="mi-zi-ge-v" />
              <div className="mi-zi-ge-d1" />
              <div className="mi-zi-ge-d2" />
            </div>

            {/* 核心修复：纯 CSS 强控大小的内嵌容器 */}
            {svgContent ? (
              <div
                className="raw-svg-container"
                dangerouslySetInnerHTML={{ __html: svgContent }}
              />
            ) : loading ? (
              <div className="loading-state">
                <div className="spinner" />
                <span>正在调用大模型预测矢量数据...</span>
              </div>
            ) : (
              <div className="empty-state">
                暂无生成内容，请在左侧配置参数并点击生成
              </div>
            )}
          </div>

          <div className="canvas-legend">
            <div style={{ display: 'flex', gap: 16 }}>
              <span className="legend-item">
                <span className="legend-dot black" /> ⬛ 黑色：用户给定笔画
              </span>
              <span className="legend-item">
                <span className="legend-dot blue" /> 🟦 蓝色：模型生成预测
              </span>
            </div>

            {meta && (
              <div className="legend-meta">
                <span>⏱️ {meta.genTime}s</span>
                <span>🪙 {meta.genTokens} tokens</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
