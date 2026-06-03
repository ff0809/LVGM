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
  const [hoveredPointIdx, setHoveredPointIdx] = useState<number | null>(null); 
  const [modalSvgViewBox, setModalSvgViewBox] = useState<string>("0 0 1024 1200");
  const [zoom, setZoom] = useState<number>(100);

  // --- ✨ 新增功能：撤销机制历史快照状态栈 ---
  const [undoStack, setUndoStack] = useState<{ x: number; y: number; xIdx: number; yIdx: number }[][]>([]);

  // 用于克隆镜像笔画的原始样式样式
  const [mirrorTransform, setMirrorTransform] = useState<string>('');
  const [mirrorAttributes, setMirrorAttributes] = useState<{ fill: string; stroke: string; strokeWidth: string }>({
    fill: 'none', stroke: '#2563eb', strokeWidth: '4'
  });

  const modalSvgRef = useRef<SVGSVGElement>(null);
  const localGroupRef = useRef<SVGGElement>(null);

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
      
      const parentTransform = targetPath.parentElement?.getAttribute('transform') || '';
      const fill = targetPath.getAttribute('fill') || 'none';
      const stroke = targetPath.getAttribute('stroke') || 'none';
      const strokeWidth = targetPath.getAttribute('stroke-width') || '4';

      setMirrorTransform(parentTransform);
      setMirrorAttributes({ fill, stroke, strokeWidth });
      setModalSvgViewBox(viewBox);
      setActiveEditPathId(pathId);
      setZoom(100); 
      setUndoStack([]); // 每次打开重置撤销栈

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

  // 工具函数：根据控制点状态组装最新的路径字符串
  const buildDString = (points: typeof controlPoints, tokens: string[]) => {
    const newTokens = [...tokens];
    points.forEach((p) => {
      newTokens[p.xIdx] = p.x.toString();
      newTokens[p.yIdx] = p.y.toString();
    });
    return newTokens.join('');
  };

  // 【核心高帧率优化】鼠标拖拽响应器 —— 期间仅修改轻量数据，绝不调用 DOMParser，彻底消灭报错与卡顿
  const handleGlobalMouseMove = (e: React.MouseEvent) => {
    if (draggedPointIdx === null || !modalSvgRef.current || !localGroupRef.current) return;

    const svgEl = modalSvgRef.current;
    const groupEl = localGroupRef.current;

    const svgPoint = svgEl.createSVGPoint();
    svgPoint.x = e.clientX;
    svgPoint.y = e.clientY;

    const ctm = groupEl.getScreenCTM();
    if (!ctm) return;

    const localPoint = svgPoint.matrixTransform(ctm.inverse());
    
    const svgX = Math.round(localPoint.x);
    const svgY = Math.round(localPoint.y);

    setControlPoints((prevPoints) => {
      const nextPoints = [...prevPoints];
      nextPoints[draggedPointIdx] = { ...nextPoints[draggedPointIdx], x: svgX, y: svgY };
      return nextPoints;
    });
  };

  // --- ✨ 新增功能：处理回退一步逻辑 ---
  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const previousPoints = undoStack[undoStack.length - 1];
    setControlPoints(previousPoints);
    setUndoStack(prev => prev.slice(0, -1)); // 弹出栈顶
  };

  // --- ✨ 新增功能：彻底放弃本次修改，原数据毫发无损关闭 ---
  const handleCancelAndClose = () => {
    setActiveEditPathId(null);
    setDraggedPointIdx(null);
    setUndoStack([]);
    setZoom(100);
  };

  // 【稳固持久化保存】点击保存时，才使用规范的 image/svg+xml 一次性写回主图层数据源
  const handleSaveAndClose = () => {
    if (!activeEditPathId || !svgContent) {
      setActiveEditPathId(null);
      return;
    }
    const finalD = buildDString(controlPoints, pathTokens);
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgContent, 'image/svg+xml'); // 修正为合法的标准 enum 枚举值
    const path = doc.getElementById(activeEditPathId);
    if (path) {
      path.setAttribute('d', finalD);
      setSvgContent(new XMLSerializer().serializeToString(doc));
    }
    setActiveEditPathId(null);
    setDraggedPointIdx(null);
    setUndoStack([]);
    setZoom(100); 
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

  const currentLiveD = activeEditPathId ? buildDString(controlPoints, pathTokens) : '';

  return (
    <section id="demo" className="content-section">
      {svgContent && (
        <style>{`
          .raw-svg-container path[data-stroke-type="generated"] {
            opacity: 0;
            pointer-events: none; 
            transition: opacity 0.4s ease-in-out;
          }
          .raw-svg-container path[data-stroke-type="generated"]:hover {
            opacity: 0.95 !important;
          }
          ${Array.from({ length: animatedStep }).map((_, i) => `
            .raw-svg-container path[data-gen-idx="${i}"] {
              opacity: 1 !important;
              pointer-events: auto !important;
            }
          `).join('')}
          
          ${activeEditPathId ? `
            .modal-interactive-svg-viewport [id="${activeEditPathId}"] {
              display: none !important;
            }
          ` : ''}
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
         ✨ 矢量笔画微调弹窗（全球矩阵投影 + 历史回退重构完美版）
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
              <div style={{ display: 'flex', gap: 10 }}>
                {/* ✨ 新增：人性化多功能辅助键操作栏 */}
                <button type="button" className="modal-aux-btn" onClick={handleUndo} disabled={undoStack.length === 0}>
                  ↩️ 撤销上一步 ({undoStack.length})
                </button>
                <button type="button" className="modal-aux-btn cancel" onClick={handleCancelAndClose}>
                  🚫 放弃修改并关闭
                </button>
                <button type="button" className="modal-close-btn" onClick={handleSaveAndClose}>
                  💾 应用并保存修改
                </button>
              </div>
            </div>

            <div className="modal-body-grid">
              {/* 左侧：双向联动数据监控列表 */}
              <div className="modal-coords-list">
                <h5>节点绝对坐标监视表 (SVG Space)</h5>
                <div className="coords-scroll-box">
                  {controlPoints.map((pt, i) => (
                    <div 
                      key={i} 
                      className={`coord-row-badge ${draggedPointIdx === i || hoveredPointIdx === i ? 'active' : ''}`}
                      onMouseEnter={() => setHoveredPointIdx(i)}
                      onMouseLeave={() => setHoveredPointIdx(null)}
                    >
                      <span className="node-idx">Node {i+1}</span>
                      <span className="node-val">X: <strong>{pt.x}</strong></span>
                      <span className="node-val">Y: <strong>{pt.y}</strong></span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 右侧：集成悬浮设计控制台与现代 Flex 漫游防裁剪画布区 */}
              <div className="modal-canvas-column">
                <div className="modal-canvas-frame">
                  
                  {/* Figma 风格悬浮设计缩放控制栏 */}
                  <div className="modal-zoom-controls">
                    <button 
                      type="button" className="zoom-btn" title="缩小"
                      onClick={() => setZoom(z => Math.max(100, z - 50))} disabled={zoom <= 100}
                    >
                      ➖
                    </button>
                    <span className="zoom-indicator">{zoom}%</span>
                    <button 
                      type="button" className="zoom-btn" title="放大"
                      onClick={() => setZoom(z => Math.min(400, z + 50))} disabled={zoom >= 400}
                    >
                      ➕
                    </button>
                    <button type="button" className="zoom-btn reset" onClick={() => setZoom(100)}>🔄 重置</button>
                  </div>

                  {/* 核心升级修复：采用物理 Flex 模型自适应滚动边界，彻底杜绝放长文本大字被切头去尾的 Bug */}
                  <div className="modal-scroll-container">
                    <div className="mi-zi-ge opacity-20"><div className="mi-zi-ge-h"/><div className="mi-zi-ge-v"/></div>
                    
                    <svg 
                      ref={modalSvgRef}
                      viewBox={modalSvgViewBox}
                      className="modal-interactive-svg-viewport"
                      style={{ 
                        width: `${90 * (zoom / 100)}%`, 
                        height: `${90 * (zoom / 100)}%`,
                        transition: 'width 0.15s ease-out, height 0.15s ease-out',
                      }}
                    >
                      {/* 底层：静态汉字参考背景 */}
                      <g dangerouslySetInnerHTML={{ __html: svgContent.match(/<svg[^>]*>([\s\S]*?)<\/svg>/)?.[1] || '' }} />

                      {/* 顶层：与背景字完全对齐的 transform 相对空间活动镜像图层 */}
                      <g ref={localGroupRef} transform={mirrorTransform}>
                        <path 
                          d={currentLiveD} 
                          fill={mirrorAttributes.fill} 
                          stroke={mirrorAttributes.stroke} 
                          strokeWidth={mirrorAttributes.strokeWidth}
                        />
                        <polyline
                          points={controlPoints.map(p => `${p.x},${p.y}`).join(' ')}
                          fill="none" stroke="#ff007f" strokeWidth="2" strokeDasharray="4,4" style={{ opacity: 0.65 }}
                        />
                        {controlPoints.map((pt, idx) => (
                          <circle
                            key={idx}
                            cx={pt.x}
                            cy={pt.y}
                            r={draggedPointIdx === idx ? "15" : hoveredPointIdx === idx ? "12" : "7"}
                            fill={draggedPointIdx === idx ? "#ff007f" : hoveredPointIdx === idx ? "#764ba2" : "#ffffff"}
                            stroke={draggedPointIdx === idx ? "#ffffff" : "#764ba2"}
                            strokeWidth="2"
                            style={{ cursor: 'move', transition: 'r 0.1s, fill 0.1s' }}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              // 按下圆点瞬间，深度拷贝一份当前数据状态压入撤销历史栈
                              setUndoStack(prev => [...prev, controlPoints.map(p => ({ ...p }))]);
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
        </div>
      )}
    </section>
  );
}