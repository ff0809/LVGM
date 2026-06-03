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

  // --- 过程展示状态 ---
  const [animatedStep, setAnimatedStep] = useState(0);
  const [totalGenerated, setTotalGenerated] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  // --- 新增：智能控制点交互微调核心状态 ---
  const [activeEditPathId, setActiveEditPathId] = useState<string | null>(null);
  const [pathTokens, setPathTokens] = useState<string[]>([]);
  const [controlPoints, setControlPoints] = useState<{ x: number; y: number; xIdx: number; yIdx: number }[]>([]);
  const [draggedPointIdx, setDraggedPointIdx] = useState<number | null>(null);
  const [modalSvgViewBox, setModalSvgViewBox] = useState<string>("0 0 1024 1200");

  const modalSvgRef = useRef<SVGSVGElement>(null);

  // 快捷键智能逻辑
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

  // 驱动笔画按时间步长依次显现
  useEffect(() => {
    if (!isAnimating || totalGenerated === 0) return;
    if (animatedStep >= totalGenerated) {
      setIsAnimating(false);
      return;
    }
    const intervalTime = Math.max(150, 400 - totalGenerated * 10);
    const timer = setTimeout(() => {
      setAnimatedStep((prev) => prev + 1);
    }, intervalTime);
    return () => clearTimeout(timer);
  }, [isAnimating, animatedStep, totalGenerated]);

  const handleReplay = () => {
    if (!svgContent) return;
    setAnimatedStep(0);
    setIsAnimating(true);
  };

  // 【核心新增】利用事件委托拦截画布中点击的具体笔画
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const targetPath = e.target as SVGPathElement;
    if (targetPath && targetPath.tagName === 'path' && targetPath.classList.contains('interactive-stroke')) {
      // 停止动画，防止冲突
      setIsAnimating(false);
      setAnimatedStep(totalGenerated);

      const pathId = targetPath.getAttribute('id');
      const dAttr = targetPath.getAttribute('d') || '';
      const svgEl = targetPath.closest('svg');
      const viewBox = svgEl?.getAttribute('viewBox') || "0 0 1024 1200";

      setModalSvgViewBox(viewBox);
      setActiveEditPathId(pathId);

      // 执行精准解构分词
      // 正则将数字捕获出来，形成：[ "M ", "120", " ", "450", " C ", "130", ... ] 的交替数组
      const tokens = dAttr.split(/(-?\d+(?:\.\d+)?)/);
      const points: typeof controlPoints = [];

      const numIndices: number[] = [];
      tokens.forEach((t, idx) => {
        if (idx % 2 === 1) numIndices.push(idx);
      });

      for (let i = 0; i < numIndices.length; i += 2) {
        const xIdx = numIndices[i];
        const yIdx = numIndices[i + 1];
        if (yIdx !== undefined) {
          points.push({
            x: parseFloat(tokens[xIdx]),
            y: parseFloat(tokens[yIdx]),
            xIdx,
            yIdx
          });
        }
      }
      setPathTokens(tokens);
      setControlPoints(points);
    }
  };

  // 【核心新增】鼠标拖拽控制点实时重构序列化
  const handleModalMouseMove = (e: React.MouseEvent) => {
    if (draggedPointIdx === null || !modalSvgRef.current || !svgContent || !activeEditPathId) return;

    const svg = modalSvgRef.current;
    const rect = svg.getBoundingClientRect();

    // 解析当前大画布对应的 ViewBox 视口宽高矩阵
    const vb = modalSvgViewBox.split(/\s+/).map(Number);
    const vbX = vb[0] || 0;
    const vbY = vb[1] || 0;
    const vbW = vb[2] || 1024;
    const vbH = vb[3] || 1200;

    // 完美映射：把屏幕像素（clientX/Y）高精度映射回大模型绝对坐标系空间
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const svgX = vbX + (mouseX / rect.width) * vbW;
    const svgY = vbY + (mouseY / rect.height) * vbH;

    // 实时更新控制点状态
    const updatedPoints = [...controlPoints];
    updatedPoints[draggedPointIdx] = {
      ...updatedPoints[draggedPointIdx],
      x: Math.round(svgX),
      y: Math.round(svgY)
    };
    setControlPoints(updatedPoints);

    // 实时将改动写回原 SVG 字符串，让背景同步发生形变微调
    const newTokens = [...pathTokens];
    updatedPoints.forEach((p) => {
      newTokens[p.xIdx] = p.x.toString();
      newTokens[p.yIdx] = p.y.toString();
    });
    const newD = newTokens.join('');

    const parser = new DOMParser();
    const doc = parser.parseFromString(svgContent, 'image/xml+xml');
    const targetPath = doc.getElementById(activeEditPathId);
    if (targetPath) {
      targetPath.setAttribute('d', newD);
      const serialized = new XMLSerializer().serializeToString(doc);
      setSvgContent(serialized);
    }
  };

  const handleGenerate = async () => {
    setLoading(true);
    setErrorMsg(null);
    setSvgContent(null);
    setMeta(null);
    setAnimatedStep(0);
    setTotalGenerated(0);
    setIsAnimating(false);
    setActiveEditPathId(null);

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
        const parser = new DOMParser();
        const doc = parser.parseFromString(data.svg, 'image/svg+xml');
        const paths = doc.querySelectorAll('path');

        let genCount = 0;
        paths.forEach((path, idx) => {
          const fill = path.getAttribute('fill') || '';
          const stroke = path.getAttribute('stroke') || '';
          const isBlue = fill.includes('blue') || fill.includes('#0000ff') || fill.includes('#2563eb') ||
            stroke.includes('blue') || stroke.includes('#0000ff') || stroke.includes('#2563eb');

          // 给每一个 path 注入全网唯一确定 ID 方便精准定位和事件编辑
          path.setAttribute('id', `lvgm-stroke-${Date.now()}-${idx}`);
          if (isBlue) {
            path.setAttribute('data-stroke-type', 'generated');
            path.setAttribute('data-gen-idx', genCount.toString());
            genCount++;
          } else {
            path.setAttribute('data-stroke-type', 'given');
          }
          path.classList.add('interactive-stroke');
        });

        const augmentedSvg = new XMLSerializer().serializeToString(doc);

        setSvgContent(augmentedSvg);
        setMeta({ genTime: data.gen_time, genTokens: data.gen_tokens });
        setTotalGenerated(genCount);
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
      {/* 动画控制沙箱 CSS */}
      {svgContent && (
        <style>{`
          .raw-svg-container path[data-stroke-type="generated"] {
            opacity: 0;
            pointer-events: none; 
            transition: opacity 0.4s ease-in-out;
          }
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
        输入汉字并指定已知笔画，预测补全字形。<b>支持交互：生成后可直接在画布中点击任意笔画，进入控制点拖拽微调系统。</b>
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
                模型推理中...
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
          <div style={{ display: 'flex', justifyBetween: 'space-between', alignItems: 'center' }}>
            <h3>SVG 渲染画布 · Canvas</h3>
            {svgContent && !loading && (
              <button
                type="button"
                onClick={handleReplay}
                disabled={isAnimating}
                className="given-toggle-btn"
                style={{ padding: '4px 10px', borderColor: '#764ba2', color: '#764ba2' }}
              >
                {isAnimating ? `🎬 正在播放 (${animatedStep}/${totalGenerated})` : '🔄 重新播放生成过程'}
              </button>
            )}
          </div>

          {/* 绑定 onClick 捕获笔画点击 */}
          <div className="canvas-container" onClick={handleCanvasClick} title="提示：点击任意笔画可进行微调控制点">
            <div className="mi-zi-ge">
              <div className="mi-zi-ge-h" />
              <div className="mi-zi-ge-v" />
              <div className="mi-zi-ge-d1" />
              <div className="mi-zi-ge-d2" />
            </div>

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
              <span className="legend-item"><span className="legend-dot black" /> ⬛ 黑色：用户给定</span>
              <span className="legend-item"><span className="legend-dot blue" /> 🟦 蓝色：模型生成</span>
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

      {/* ==========================================================================
         ✨ 全新高阶能力：人机协同智能笔画控制点微调弹窗 (Control Points Modal)
         ========================================================================== */}
      {activeEditPathId && svgContent && (
        <div className="stroke-edit-modal-backdrop">
          <div className="stroke-edit-modal-card">

            {/* Modal Header */}
            <div className="modal-header">
              <div>
                <h4>✍️ 矢量笔画控制点微调面板</h4>
                <p>当前选中笔画节点数：<strong>{controlPoints.length} 个</strong>。长按并拖拽高亮节点可任意纠正大模型生成瑕疵。</p>
              </div>
              <button className="modal-close-btn" onClick={() => setActiveEditPathId(null)}>✕ 关闭并应用</button>
            </div>

            {/* Modal Content Main Body */}
            <div className="modal-body-grid">

              {/* 左侧：节点精确坐标监视器 */}
              <div className="modal-coords-list">
                <h5>节点绝对坐标表 (SVG Space)</h5>
                <div className="coords-scroll-box">
                  {controlPoints.map((pt, i) => (
                    <div
                      key={i}
                      className={`coord-row-badge ${draggedPointIdx === i ? 'active' : ''}`}
                      onMouseEnter={() => setDraggedPointIdx(i)}
                      onMouseLeave={() => setDraggedPointIdx(null)}
                    >
                      <span className="node-idx">Node {i + 1}</span>
                      <span className="node-val">X: <strong>{pt.x}</strong></span>
                      <span className="node-val">Y: <strong>{pt.y}</strong></span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs leading-relaxed">
                  💡 <b>学术价值提示</b>：此处手动修正数据可用于生成强化学习人类反馈 (RLHF) 修正数据集，用来进一步对字形模型进行对齐微调。
                </div>
              </div>

              {/* 右侧：放大聚焦的高清交互矢量画布 */}
              <div className="modal-canvas-column">
                <div
                  className="modal-canvas-frame"
                  onMouseMove={handleModalMouseMove}
                  onMouseUp={() => setDraggedPointIdx(null)}
                  onMouseLeave={() => setDraggedPointIdx(null)}
                >
                  {/* 精细米字背景线 */}
                  <div className="mi-zi-ge opacity-40"><div className="mi-zi-ge-h" /><div className="mi-zi-ge-v" /></div>

                  {/* 核心双层 SVG 叠加层 */}
                  <svg
                    ref={modalSvgRef}
                    viewBox={modalSvgViewBox}
                    className="modal-interactive-svg-viewport"
                  >
                    {/* 底层：原封不动渲染整组汉字结构（利用 CSS 规则将非活动笔画全部变淡） */}
                    <g dangerouslySetInnerHTML={{ __html: svgContent.match(/<svg[^>]*>([\s\S]*?)<\/svg>/)?.[1] || '' }} />

                    {/* 顶层：覆盖绘制当前正在被微调的骨骼多边形和可拖动控制圆形点 */}
                    <g className="骨骼追踪器">
                      {/* 绘制骨骼折线图，辅助看清曲率变化 */}
                      <polyline
                        points={controlPoints.map(p => `${p.x},${p.y}`).join(' ')}
                        fill="none"
                        stroke="#ff007f"
                        strokeWidth="2"
                        strokeDasharray="4,4"
                        className="opacity-70"
                      />
                      {controlPoints.map((pt, idx) => (
                        <circle
                          key={idx}
                          cx={pt.x}
                          cy={pt.y}
                          r={draggedPointIdx === idx ? "12" : "7"}
                          fill={draggedPointIdx === idx ? "#ff007f" : "#ffffff"}
                          stroke={draggedPointIdx === idx ? "#ffffff" : "#764ba2"}
                          strokeWidth={draggedPointIdx === idx ? "3" : "2"}
                          style={{ cursor: 'move', transition: 'r 0.1s, fill 0.1s' }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setDraggedPointIdx(idx);
                          }}
                        />
                      ))}
                    </g>
                  </svg>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

    </section>
  );
}