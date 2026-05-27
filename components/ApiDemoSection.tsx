"use client";

import React, { useState, useEffect, useRef } from 'react';

export function ApiDemoSection() {
  const [prompt, setPrompt] = useState('不');
  const [given, setGiven] = useState('1');
  const [temperature, setTemperature] = useState(0.8);
  const [topP, setTopP] = useState(0.9);

  const [loading, setLoading] = useState(false);
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ genTime: number; genTokens: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // --- 新增：动态全流式书写过程控制状态 ---
  const [animatedStep, setAnimatedStep] = useState(0);
  const [totalGenerated, setTotalGenerated] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  // 快捷键智能逻辑：根据当前 prompt 汉字长度动态拼接 given 格式
  const applyPreset = (type: 'all' | 'all-but-last' | 'only-first') => {
    const len = prompt.trim().length || 1;
    if (type === 'all') {
      setGiven(''); 
    } else if (type === 'all-but-last') {
      if (len <= 1) {
        setGiven('1');
      } else {
        const arr = Array(len - 1).fill('all');
        arr.push('1');
        setGiven(arr.join(','));
      }
    } else if (type === 'only-first') {
      setGiven(Array(len).fill('1').join(','));
    }
  };

  // 核心动效：驱动笔画按时间步长依次显现
  useEffect(() => {
    if (!isAnimating || totalGenerated === 0) return;
    
    if (animatedStep >= totalGenerated) {
      setIsAnimating(false);
      return;
    }

    const intervalTime = Math.max(150, 400 - totalGenerated * 10); // 根据笔画多少动态调整书写速度
    const timer = setTimeout(() => {
      setAnimatedStep((prev) => prev + 1);
    }, intervalTime);

    return () => clearTimeout(timer);
  }, [isAnimating, animatedStep, totalGenerated]);

  // 手动触发重新播放动画
  const handleReplay = () => {
    if (!svgContent) return;
    setAnimatedStep(0);
    setIsAnimating(true);
  };

  const handleGenerate = async () => {
    setLoading(true);
    setErrorMsg(null);
    setSvgContent(null);
    setMeta(null);
    setAnimatedStep(0);
    setTotalGenerated(0);
    setIsAnimating(false);

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
        // 【核心改进】解析注入：将静态 SVG 变成可动态编程和交互的独立笔画对象
        const parser = new DOMParser();
        const doc = parser.parseFromString(data.svg, 'image/svg+xml');
        const paths = doc.querySelectorAll('path');
        
        let genCount = 0;
        paths.forEach((path) => {
          const fill = path.getAttribute('fill') || '';
          const stroke = path.getAttribute('stroke') || '';
          // 智能判定当前 path 是否属于 AI 预测生成的蓝色笔画范围
          const isBlue = fill.includes('blue') || fill.includes('#0000ff') || fill.includes('#2563eb') || 
                         stroke.includes('blue') || stroke.includes('#0000ff') || stroke.includes('#2563eb');
          
          if (isBlue) {
            path.setAttribute('data-stroke-type', 'generated');
            path.setAttribute('data-gen-idx', genCount.toString());
            genCount++;
          } else {
            path.setAttribute('data-stroke-type', 'given');
          }
          // 注入全局高亮交互类名
          path.classList.add('interactive-stroke');
        });

        const augmentedSvg = new XMLSerializer().serializeToString(doc);
        
        setSvgContent(augmentedSvg);
        setMeta({ genTime: data.gen_time, genTokens: data.gen_tokens });
        setTotalGenerated(genCount);
        
        // 数据准备完毕，立刻开启书写过程动画演示
        setAnimatedStep(0);
        setIsAnimating(true);

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
      {/* 动态注入精细至笔画控制的局部 CSS 规则 */}
      {svgContent && (
        <style>{`
          /* 未点亮的生成笔画，无论如何高高挂起绝对隐形，且不响应鼠标悬停 */
          .raw-svg-container path[data-stroke-type="generated"] {
            opacity: 0;
            pointer-events: none; 
            transition: opacity 0.4s ease-in-out;
          }
          /* 随着时间轴被点亮的笔画，恢复接收鼠标事件，并赋予完整不透明度 */
          ${Array.from({ length: animatedStep }).map((_, i) => `
            .raw-svg-container path[data-gen-idx="${i}"] {
              opacity: 1 !important;
              pointer-events: auto !important;
            }
          `).join('')}
        `}</style>
      )}

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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>SVG 渲染画布 · Canvas</h3>
            {svgContent && !loading && (
              <button 
                type="button" 
                onClick={handleReplay} 
                disabled={isAnimating}
                className="given-toggle-btn"
                style={{ padding: '4px 10px', borderColor: '#764ba2', color: '#764ba2', opacity: isAnimating ? 0.5 : 1 }}
              >
                {isAnimating ? `🎬 正在播放 (${animatedStep}/${totalGenerated})` : '🔄 重新播放生成过程'}
              </button>
            )}
          </div>

          <div className="canvas-container">
            {/* 精致红线米字格 */}
            <div className="mi-zi-ge">
              <div className="mi-zi-ge-h" />
              <div className="mi-zi-ge-v" />
              <div className="mi-zi-ge-d1" />
              <div className="mi-zi-ge-d2" />
            </div>

            {/* 核心内嵌容器 */}
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
                {totalGenerated > 0 && <span style={{ color: '#764ba2', fontWeight: 'bold' }}>✍️ 补全 {totalGenerated} 笔</span>}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}