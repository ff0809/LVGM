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
  
  // 用于克隆镜像笔画的原始样式样式
  const [mirrorTransform, setMirrorTransform] = useState<string>('');
  const [mirrorAttributes, setMirrorAttributes] = useState<{ fill: string; stroke: string; strokeWidth: string }>({
    fill: 'none', stroke: '#2563eb', strokeWidth: '4'
  });

  const modalSvgRef = useRef<SVGSVGElement>(null);
  const localGroupRef = useRef<SVGGElement>(null); // 精准定位空间原点的核心句柄

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
      
      // 【关键修复】提取父级字符组的 transform 属性（横向平移 translate 数据）
      const parentTransform = targetPath.parentElement?.getAttribute('transform') || '';
      const fill = targetPath.getAttribute('fill') || 'none';
      const stroke = targetPath.getAttribute('stroke') || 'none';
      const strokeWidth = targetPath.getAttribute('stroke-width') || '4';

      setMirrorTransform(parentTransform);
      setMirrorAttributes({ fill, stroke, strokeWidth });
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

  // 工具函数：根据控制点状态组装最新的路径字符串
  const buildDString = (points: typeof controlPoints, tokens: string[]) => {
    const newTokens = [...tokens];
    points.forEach((p) => {
      newTokens[p.xIdx] = p.x.toString();
      newTokens[p.yIdx] = p.y.toString();
    });
    return newTokens.join('');
  };

  // 【核心升级修复】由独立微调图层承载的高灵敏全局鼠标拖拽响应器
  const handleGlobalMouseMove = (e: React.MouseEvent) => {
    if (draggedPointIdx === null || !modalSvgRef.current || !localGroupRef.current) return;

    const svgEl = modalSvgRef.current;
    const groupEl = localGroupRef.current;

    // 1. 创建原生的 SVG 交互矩阵标定点
    const svgPoint = svgEl.createSVGPoint();
    svgPoint.x = e.clientX;
    svgPoint.y = e.clientY;

    // 2. 获取当前克隆图层的屏幕坐标变换矩阵
    const ctm = groupEl.getScreenCTM();
    if (!ctm) return;

    // 3. 执行逆矩阵映射：精准换算到与原笔画完完全全等价的局部空间坐标系，完美治愈错位飞走
    const localPoint = svgPoint.matrixTransform(ctm.inverse());
    
    const svgX = Math.round(localPoint.x);
    const svgY = Math.round(localPoint.y);

    // 4. 只实时更新轻量级的 React 状态线，绝不触碰和重构底层大的 background HTML 字符串
    setControlPoints((prevPoints) => {
      const nextPoints = [...prevPoints];
      nextPoints[draggedPointIdx] = { ...nextPoints[draggedPointIdx], x: svgX, y: svgY };
      return nextPoints;
    });
  };

  // 【持久化保存核心】在点击关闭时，才一次性完成总数据反向序列化写回主界面
  const handleSaveAndClose = () => {
    if (!activeEditPathId || !svgContent) {
      setActiveEditPathId(null);
      return;
    }

    const finalD = buildDString(controlPoints, pathTokens);
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgContent, 'image/svg+xml');
    const path = doc.getElementById(activeEditPathId);
    
    if (path) {
      path.setAttribute('d', finalD);
      // 永久持久化保存
      setSvgContent(new XMLSerializer().serializeToString(doc));
    }
    setActiveEditPathId(null);
    setDraggedPointIdx(null);
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

  // 计算弹窗中当前独立图层上实时形变的路径 d 数据
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
          ${Array.from({ length: animatedStep }).map((_, i) => `
            .raw-svg-container path[data-gen-idx="${i}"] {
              opacity: 1 !important;
              pointer-events: auto !important;
            }
          `).join('')}
          
          /* 当进入编辑模式时，在弹窗中彻底隐藏掉背景大字树里的那根老笔画，防止重叠双重影 */
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
         ✨ 矢量笔画微调弹窗（矩阵同步 + 局部图层解耦重组终极版）
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
              <button className="modal-close-btn" onClick={handleSaveAndClose}>✕ 关闭并应用修改</button>
            </div>

            <div className="modal-body-grid">
              {/* 左侧：已彻底修复乱跳 Bug 的纯粹数据查看器 */}
              <div className="modal-coords-list">
                <h5>节点绝对坐标监视表 (SVG Space)</h5>
                <div className="coords-scroll-box">
                  {controlPoints.map((pt, i) => (
                    <div 
                      key={i} 
                      className={`coord-row-badge ${draggedPointIdx === i || hoveredPointIdx === i ? 'active' : ''}`}
                      onMouseEnter={() => setHoveredPointIdx(i)} // 悬停仅触发表格行与右侧圆点的高亮联动
                      onMouseLeave={() => setHoveredPointIdx(null)}
                    >
                      <span className="node-idx">Node {i+1}</span>
                      <span className="node-val">X: <strong>{pt.x}</strong></span>
                      <span className="node-val">Y: <strong>{pt.y}</strong></span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 右侧：长文本自适应、高保真无抖动微调视口 */}
              <div className="modal-canvas-column">
                <div className="modal-canvas-frame">
                  <div className="mi-zi-ge opacity-20"><div className="mi-zi-ge-h"/><div className="mi-zi-ge-v"/></div>

                  <svg 
                    ref={modalSvgRef}
                    viewBox={modalSvgViewBox}
                    className="modal-interactive-svg-viewport"
                  >
                    {/* 底层底层：纯静态文本骨架作为位置底图（只读，MouseMove 时绝不刷新，CORS/CTM 极其稳定） */}
                    <g dangerouslySetInnerHTML={{ __html: svgContent.match(/<svg[^>]*>([\s\S]*?)<\/svg>/)?.[1] || '' }} />

                    {/* 顶层顶层：【关键升级】将活动路径及手柄，包裹进与原汉字完全共享的平移空间上下文 */}
                    <g ref={localGroupRef} transform={mirrorTransform}>
                      
                      {/* 实时的响应式活动路径图层 */}
                      <path 
                        d={currentLiveD} 
                        fill={mirrorAttributes.fill} 
                        stroke={mirrorAttributes.stroke} 
                        strokeWidth={mirrorAttributes.strokeWidth}
                        style={{ opacity: 1 }}
                      />

                      {/* 辅助曲率骨骼线 */}
                      <polyline
                        points={controlPoints.map(p => `${p.x},${p.y}`).join(' ')}
                        fill="none" stroke="#ff007f" strokeWidth="2" strokeDasharray="4,4" style={{ opacity: 0.65 }}
                      />

                      {/* 交互圆点 */}
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
                            setDraggedPointIdx(idx); // 此处按下鼠标，才是合法唯一的拖拽锁
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