"use client";

import React, { useState, useEffect } from 'react';

interface PipelineVisualizerProps {
  isProcessing: boolean;
  svgContent: string | null;
}

// 模拟的流水线步骤
type PipelineStep = 
  | 'idle'
  | 'parsing'      // 解析 SVG → 64×3
  | 'reshaping'    // 64×3 → 6×8×8
  | 'encoding'     // StrokeEncoder
  | 'quantizing'   // 向量量化
  | 'decoding'     // StrokeDecoder
  | 'rendering'    // 重建 SVG
  | 'complete';

// 模拟 64×3 笔画参数（只展示前几行）
function generateMockStrokeParams(): number[][] {
  const params: number[][] = [];
  for (let i = 0; i < 64; i++) {
    params.push([
      Math.random() * 200,
      Math.random() * 200,
      Math.random() * 50 + 10,
    ]);
  }
  return params;
}

// 模拟 6×8×8 特征块（展示简化版）
function generateMock6x8x8(): number[][][] {
  const block: number[][][] = [];
  for (let c = 0; c < 6; c++) {
    const plane: number[][] = [];
    for (let h = 0; h < 8; h++) {
      const row: number[] = [];
      for (let w = 0; w < 8; w++) {
        row.push(Math.random());
      }
      plane.push(row);
    }
    block.push(plane);
  }
  return block;
}

// 模拟 8×8 索引矩阵
function generateMockIndices(): number[][] {
  const indices: number[][] = [];
  for (let i = 0; i < 8; i++) {
    const row: number[] = [];
    for (let j = 0; j < 8; j++) {
      row.push(Math.floor(Math.random() * 30000));
    }
    indices.push(row);
  }
  return indices;
}

export function PipelineVisualizer({ isProcessing, svgContent }: PipelineVisualizerProps) {
  const [currentStep, setCurrentStep] = useState<PipelineStep>('idle');
  const [strokeParams, setStrokeParams] = useState<number[][] | null>(null);
  const [featureBlock, setFeatureBlock] = useState<number[][][] | null>(null);
  const [indices, setIndices] = useState<number[][] | null>(null);
  const [encoderActivations, setEncoderActivations] = useState<number[] | null>(null);
  const [decodedParams, setDecodedParams] = useState<number[][] | null>(null);
  const [isRendered, setIsRendered] = useState(false);

  // 使用 ref 追踪是否已启动流水线
  const pipelineStartedRef = React.useRef(false);

  // 模拟处理流程 - 只在 isProcessing 从 false 变为 true 时启动
  useEffect(() => {
    if (isProcessing && !pipelineStartedRef.current) {
      // 标记流水线已启动
      pipelineStartedRef.current = true;
      
      // 开始新处理时重置为 parsing
      setCurrentStep('parsing');
      
      const steps: { step: PipelineStep; delay: number; action?: () => void }[] = [
        { 
          step: 'parsing', 
          delay: 250,
          action: () => setStrokeParams(generateMockStrokeParams())
        },
        { 
          step: 'reshaping', 
          delay: 200,
          action: () => setFeatureBlock(generateMock6x8x8())
        },
        { 
          step: 'encoding', 
          delay: 300,
          action: () => setEncoderActivations(Array.from({ length: 8 }, () => Math.random()))
        },
        { 
          step: 'quantizing', 
          delay: 250,
          action: () => setIndices(generateMockIndices())
        },
        { 
          step: 'decoding', 
          delay: 250,
          action: () => setDecodedParams(generateMockStrokeParams())
        },
        { 
          step: 'rendering', 
          delay: 200,
          action: () => setIsRendered(true)
        },
        { step: 'complete', delay: 50 },
      ];

      let totalDelay = 0;

      steps.forEach(({ step, delay, action }) => {
        setTimeout(() => {
          setCurrentStep(step);
          action?.();
        }, totalDelay);
        totalDelay += delay;
      });
    }
    
    // 当 isProcessing 变回 false 时，重置 ref 以便下次可以再次启动
    if (!isProcessing) {
      pipelineStartedRef.current = false;
    }
  }, [isProcessing]);

  // 当开始新的处理时重置状态
  useEffect(() => {
    if (isProcessing) {
      // 开始新处理时重置所有数据
      setStrokeParams(null);
      setFeatureBlock(null);
      setIndices(null);
      setEncoderActivations(null);
      setDecodedParams(null);
      setIsRendered(false);
    }
    // 处理完成后保持数据显示，不清除
  }, [isProcessing]);

  const stepLabels: Record<PipelineStep, string> = {
    idle: '等待输入',
    parsing: '解析 SVG → 64×3 笔画参数',
    reshaping: '空间重组 64×3 → 6×8×8',
    encoding: 'StrokeEncoder 卷积编码',
    quantizing: '向量量化 (查询 30K 码本)',
    decoding: 'StrokeDecoder 解码重建',
    rendering: '渲染重建 SVG',
    complete: '处理完成',
  };

  const getStepStatus = (step: PipelineStep): 'pending' | 'active' | 'complete' => {
    const stepOrder: PipelineStep[] = ['idle', 'parsing', 'reshaping', 'encoding', 'quantizing', 'decoding', 'rendering', 'complete'];
    const currentIndex = stepOrder.indexOf(currentStep);
    const stepIndex = stepOrder.indexOf(step);
    
    if (stepIndex < currentIndex) return 'complete';
    if (stepIndex === currentIndex) return 'active';
    return 'pending';
  };

  return (
    <div className="pipeline-visualizer">
      <h3>Stage 1: Vectorization 流水线</h3>
      
      {/* 步骤指示器 */}
      <div className="pipeline-steps">
        {(['parsing', 'reshaping', 'encoding', 'quantizing', 'decoding', 'rendering'] as PipelineStep[]).map((step, idx) => {
          const status = getStepStatus(step);
          return (
            <div key={step} className={`pipeline-step ${status}`}>
              <div className="step-number">{idx + 1}</div>
              <div className="step-label">{stepLabels[step].split(' ')[0]}</div>
            </div>
          );
        })}
      </div>

      {/* 当前步骤详情 */}
      <div className="current-step-info">
        <span className="step-indicator">{currentStep !== 'idle' && currentStep !== 'complete' ? '▶' : '●'}</span>
        <span>{stepLabels[currentStep]}</span>
      </div>

      {/* 数据可视化区域 */}
      <div className="data-visualization">
        {/* 64×3 笔画参数 */}
        {strokeParams && (
          <div className="data-block stroke-params">
            <h4>笔画参数矩阵 (64×3)</h4>
            <div className="matrix-preview">
              <table>
                <thead>
                  <tr>
                    <th></th>
                    <th>x</th>
                    <th>y</th>
                    <th>w</th>
                  </tr>
                </thead>
                <tbody>
                  {strokeParams.slice(0, 5).map((row, i) => (
                    <tr key={i}>
                      <td className="row-label">[{i}]</td>
                      {row.map((val, j) => (
                        <td key={j}>{val.toFixed(1)}</td>
                      ))}
                    </tr>
                  ))}
                  <tr className="ellipsis-row">
                    <td colSpan={4}>... (共 64 行)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 6×8×8 特征块 */}
        {featureBlock && (
          <div className="data-block feature-block">
            <h4>特征块 (6×8×8)</h4>
            <div className="feature-heatmap">
              {featureBlock.slice(0, 3).map((plane, c) => (
                <div key={c} className="feature-plane">
                  <span className="plane-label">C{c}</span>
                  <div className="heatmap-grid">
                    {plane.map((row, h) => (
                      <div key={h} className="heatmap-row">
                        {row.map((val, w) => (
                          <div
                            key={w}
                            className="heatmap-cell"
                            style={{
                              backgroundColor: `rgba(59, 130, 246, ${val})`,
                            }}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div className="more-planes">+3 channels</div>
            </div>
          </div>
        )}

        {/* 编码器激活 */}
        {encoderActivations && (
          <div className="data-block encoder-activations">
            <h4>Encoder 激活值</h4>
            <div className="activation-bars">
              {encoderActivations.map((val, i) => (
                <div key={i} className="activation-bar-container">
                  <div
                    className="activation-bar"
                    style={{ height: `${val * 100}%` }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 8×8 索引矩阵 */}
        {indices && (
          <div className="data-block indices-matrix">
            <h4>笔画嵌入索引 (8×8)</h4>
            <p className="indices-desc">每个数字 ∈ [0, 29999]，对应码本中的一个向量</p>
            <div className="indices-grid">
              {indices.map((row, i) => (
                <div key={i} className="indices-row">
                  {row.map((val, j) => (
                    <div key={j} className="index-cell">
                      {val}
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <p className="indices-note">
              这 64 个索引就是汉字的「基因序列」，将作为 Stage 2 的输入
            </p>
          </div>
        )}

        {/* 解码后的参数 */}
        {decodedParams && (
          <div className="data-block decoded-params">
            <h4>解码重建参数 (64×3)</h4>
            <div className="matrix-preview">
              <table>
                <thead>
                  <tr>
                    <th></th>
                    <th>x&apos;</th>
                    <th>y&apos;</th>
                    <th>w&apos;</th>
                  </tr>
                </thead>
                <tbody>
                  {decodedParams.slice(0, 5).map((row, i) => (
                    <tr key={i}>
                      <td className="row-label">[{i}]</td>
                      {row.map((val, j) => (
                        <td key={j}>{val.toFixed(1)}</td>
                      ))}
                    </tr>
                  ))}
                  <tr className="ellipsis-row">
                    <td colSpan={4}>... (共 64 行)</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="decode-note">与原始参数对比，存在微小量化误差</p>
          </div>
        )}

        {/* 渲染完成状态 */}
        {isRendered && (
          <div className="data-block render-complete">
            <h4>渲染完成</h4>
            <div className="render-status">
              <span className="check-icon">&#10003;</span>
              <span>SVG 已重建完成，请查看右侧「生成结果」</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
