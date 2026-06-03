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

  // --- 矢量控制点微调核心状态 ---
  const [activeEditPathId, setActiveEditPathId] = useState<string | null>(null);
  const [pathTokens, setPathTokens] = useState<string[]>([]);
  const [controlPoints, setControlPoints] = useState<{ x: number; y: number; xIdx: number; yIdx: number }[]>([]);
  const [draggedPointIdx, setDraggedPointIdx] = useState<number | null>(null);
  const [hoveredPointIdx, setHoveredPointIdx] = useState<number | null>(null); // 新增：纯悬停高亮索引
  const [modalSvgViewBox, setModalSvgViewBox] = useState<string>("0 0 1024 1200");
  
  const modalSvgRef = useRef<SVGSVGElement>(null);

  // 智能笔画预设
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

  // 拦截主画布中点击的具体笔画并进入微调
  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const targetPath = e.target as SVGPathElement;
    if (targetPath && targetPath.tagName === 'path' && targetPath.classList.contains('interactive-stroke')) {
      setIsAnimating(false);
      setAnimatedStep(totalGenerated);

      const pathId = targetPath.getAttribute('id');
      const dAttr = targetPath.getAttribute('d') || '';
      const svgEl = targetPath.closest('svg');
      const viewBox = svgEl?.getAttribute('viewBox') || "0 0 1024 1200";
      
      setModalSvgViewBox(viewBox);
      setActiveEditPathId(pathId);
      
      // 精准解构分词
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
          points.push({ x: parseFloat(tokens[xIdx]), y: parseFloat(tokens[yIdx]), xIdx, yIdx });
        }
      }
      setPathTokens(tokens);
      setControlPoints(points);
    }
  };

  // 【核心修复：全球矩阵投影算法】解决多字 transform 造成的笔画飞走错位 Bug
  const handleGlobalMouseMove = (e: React.MouseEvent) => {
    if (draggedPointIdx === null || !modalSvgRef.current || !svgContent || !activeEditPathId) return;

    const svgEl = modalSvgRef.current;
    // 准确定位弹窗内部渲染的那根活动 Path 节点
    const targetPathInModal = svgEl.querySelector(`[id="${activeEditPathId}"]`);
    if (!targetPathInModal) return;

    // 1. 创建 SVG 标定点
    const svgPoint = svgEl.createSVGPoint();
    svgPoint.x = e.clientX;
    svgPoint.y = e.clientY;

    // 2. 获取该笔画所依附的父级元素（即带有 translate 偏移的字符组 <g>）的屏幕坐标变换矩阵 (CTM)
    const parentElement = targetPathInModal.parentElement || svgEl;
    const ctm = parentElement.getScreenCTM();
    if (!ctm) return;

    // 3. 执行矩阵逆变换：将屏幕绝对像素无损转换回当前汉字的【局部相对坐标系空间】
    const localPoint = svgPoint.matrixTransform(ctm.inverse());
    
    const svgX = Math.round(localPoint.x);
    const svgY = Math.round(localPoint.y);

    // 4. 函数式实时形变响应与重构序列化，彻底杜绝数据丢失
    setControlPoints((prevPoints) => {
      const nextPoints = [...prevPoints];
      nextPoints[draggedPointIdx] = { ...nextPoints[draggedPointIdx], x: svgX, y: svgY };

      const newTokens = [...pathTokens];
      nextPoints.forEach((p) => {
        newTokens[p.xIdx] = p.x.toString();
        newTokens[p.yIdx] = p.y.toString();
      });
      const newD = newTokens.join('');

      // 同步更新顶层核心数据源
      setSvgContent((prevSvg) => {
        if (!prevSvg) return null;
        const parser = new DOMParser();
        const doc = parser.parseFromString(prevSvg, 'image/xml+xml');
        const path = doc.getElementById(activeEditPathId);
        if (path) {
          path.setAttribute('d', newD);
          return new XMLSerializer().serializeToString(doc);
        }
        return prevSvg;
      });

      return nextPoints;
    });
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

    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: prompt.trim(),
          ...(given.trim() !== '' ? { given: given.trim() } : {}),
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

        setSvgContent(new XMLSerializer().serializeToString(doc));
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
        输入汉字并指定已知笔画，预测补全字形。生成后可直接在画布中<b>点击任意笔画</b>进行控制点拖拽微调。
      </p>

      <div className="api-demo-wrapper">
        {/* 左侧控制面板 */}
        <div className="api-demo-controls">
          <div className="control-group">
            <label htmlFor="api-prompt">输入汉字 (prompt)</label>
            <input
              id="api-prompt" type="text" value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="请输入汉字" className="custom-input font-bold"
            />
          </div>

          <div className="control-group">
            <label>智能笔画预设 · Smart Presets</label>
            <div className="given-toggle-row">
              <button type="button" onClick={() => applyPreset('all')} className="given-toggle-btn">🏛️ 全字给全</button>
              <button type="button" onClick={() => applyPreset('all-but-last')} className="given-toggle-btn">🎯 末字预测</button>
              <button type="button" onClick={() => applyPreset('only-first')} className="given-toggle-btn">✨ 全留首笔</button>
            </div>
            <label htmlFor="api-given" style={{ marginTop: '12px' }}>已知笔画值 (given)</label>
            <input
              id="api-given" type="text" value={given}
              onChange={(e) => setGiven(e.target.value)} className="custom-input font-mono"
            />
          </div>

          <div className="api-params-box">
            <h4>高级采样参数</h4>
            <div className="control-group">
              <div className="param-label-row"><span>采样温度:</span><strong>{temperature}</strong></div>
              <input type="range" min="0.1" max="2.0" step="0.1" value={temperature} onChange={(e) => setTemperature(parseFloat(e.target.value))}/>
            </div>
            <div className="control-group">
              <div className="param-label-row"><span>Top_p:</span><strong>{topP}</strong></div>
              <input type="range" min="0.0" max="1.0" step="0.05" value={topP} onChange={(e) => setTopP(parseFloat(e.target.value))}/>
            </div>
          </div>

          <button className="generate-btn" onClick={handleGenerate} disabled={loading || !prompt.trim()}>
            {loading ? '模型推理中...' : '开始生成笔画'}
          </button>

          {errorMsg && <div className="api-error-box">{errorMsg}</div>}
        </div>

        {/* 右侧主画布 */}
        <div className="api-demo-canvas">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>SVG 渲染画布 · Canvas</h3>
            {svgContent && !loading && (
              <button type="button" onClick={handleReplay} disabled={isAnimating} className="given-toggle-btn" style={{ color: '#764ba2' }}>
                {isAnimating ? `🎬 正在播放 (${animatedStep}/${totalGenerated})` : '🔄 重新播放'}
              </button>
            )}
          </div>

          <div className="canvas-container" onClick={handleCanvasClick}>
            <div className="mi-zi-ge">
              <div className="mi-zi-ge-h" /><div className="mi-zi-ge-v" />
            </div>
            {svgContent ? <div className="raw-svg-container" dangerouslySetInnerHTML={{ __html: svgContent }} /> : <div className="empty-state">暂无生成内容</div>}
          </div>
        </div>
      </div>

      {/* ==========================================================================
         ✨ 矢量笔画微调弹窗（全球追踪 + 局部逆矩阵对齐完美版）
         ========================================================================== */}
      {activeEditPathId && svgContent && (
        <div 
          className="stroke-edit-modal-backdrop"
          onMouseMove={handleGlobalMouseMove}
          onMouseUp={() => setDraggedPointIdx(null)}
        >
          <div className="stroke-edit-modal-card" onClick={(e) => e.stopPropagation()}>
            
            <div className="modal-header">
              <div>
                <h4>✍️ 矢量笔画控制点微调面板</h4>
                <p>当前选中笔画节点数：<strong>{controlPoints.length} 个</strong>。按住并拖拽高亮圆点可实时修正字形瑕疵。</p>
              </div>
              <button className="modal-close-btn" onClick={() => setActiveEditPathId(null)}>✕ 关闭并应用修改</button>
            </div>

            <div className="modal-body-grid">
              {/* 左侧：双向高亮数据列表（已修复乱跳 Bug） */}
              <div className="modal-coords-list">
                <h5>节点绝对坐标监视表 (SVG Space)</h5>
                <div className="coords-scroll-box">
                  {controlPoints.map((pt, i) => (
                    <div 
                      key={i} 
                      className={`coord-row-badge ${draggedPointIdx === i || hoveredPointIdx === i ? 'active' : ''}`}
                      onMouseEnter={() => setHoveredPointIdx(i)} // 悬停仅作两边缘亮指示
                      onMouseLeave={() => setHoveredPointIdx(null)}
                    >
                      <span className="node-idx">Node {i+1}</span>
                      <span className="node-val">X: <strong>{pt.x}</strong></span>
                      <span className="node-val">Y: <strong>{pt.y}</strong></span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 右侧：纵向高弹性伸缩、长文本自适应不裁剪视口 */}
              <div className="modal-canvas-column">
                <div className="modal-canvas-frame">
                  <div className="mi-zi-ge opacity-20"><div className="mi-zi-ge-h"/><div className="mi-zi-ge-v"/></div>

                  <svg 
                    ref={modalSvgRef}
                    viewBox={modalSvgViewBox}
                    className="modal-interactive-svg-viewport"
                  >
                    {/* 底层：原封不动渲染整组汉字作为绝对参考骨架 */}
                    <g dangerouslySetInnerHTML={{ __html: svgContent.match(/<svg[^>]*>([\s\S]*?)<\/svg>/)?.[1] || '' }} />

                    {/* 顶层：直接覆盖绘制活动骨骼及控制点句柄 */}
                    <g>
                      <polyline
                        points={controlPoints.map(p => `${p.x},${p.y}`).join(' ')}
                        fill="none" stroke="#ff007f" strokeWidth="2" strokeDasharray="4,4" style={{ opacity: 0.65 }}
                      />
                      {controlPoints.map((pt, idx) => (
                        <circle
                          key={idx}
                          cx={pt.x}
                          cy={pt.y}
                          // 如果正在被拖动或在左侧列表处于悬停状态，圆点会动态放大，交互感拉满
                          r={draggedPointIdx === idx ? "15" : hoveredPointIdx === idx ? "12" : "7"}
                          fill={draggedPointIdx === idx ? "#ff007f" : hoveredPointIdx === idx ? "#764ba2" : "#ffffff"}
                          stroke={draggedPointIdx === idx ? "#ffffff" : "#764ba2"}
                          strokeWidth="2"
                          style={{ cursor: 'move', transition: 'r 0.1s, fill 0.1s' }}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setDraggedPointIdx(idx); // 只有在这里按下鼠标，才是真正的拖拽开始
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