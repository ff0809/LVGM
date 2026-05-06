"use client";

import React, { useState, useEffect } from 'react';

type PipelineStep = 'idle' | 'parsing' | 'reshaping' | 'encoding' | 'quantizing' | 'decoding' | 'rendering' | 'complete';

function generateMockStrokeParams(): number[][] {
  return Array.from({ length: 64 }, () => [
    Math.random() * 200,
    Math.random() * 200,
    Math.random() * 50 + 10,
  ]);
}

function generateMock6x8x8(): number[][][] {
  return Array.from({ length: 6 }, () =>
    Array.from({ length: 8 }, () =>
      Array.from({ length: 8 }, () => Math.random())
    )
  );
}

function generateMockIndices(): number[][] {
  return Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () => Math.floor(Math.random() * 30000))
  );
}

interface PipelineVisualizerProps {
  isProcessing: boolean;
  svgContent: string | null;
}

export function PipelineVisualizer({ isProcessing }: PipelineVisualizerProps) {
  const [currentStep, setCurrentStep] = useState<PipelineStep>('idle');
  const [strokeParams, setStrokeParams] = useState<number[][] | null>(null);
  const [featureBlock, setFeatureBlock] = useState<number[][][] | null>(null);
  const [indices, setIndices] = useState<number[][] | null>(null);
  const [encoderActivations, setEncoderActivations] = useState<number[] | null>(null);
  const [decodedParams, setDecodedParams] = useState<number[][] | null>(null);
  const [isRendered, setIsRendered] = useState(false);

  const pipelineStartedRef = React.useRef(false);

  // 重置所有数据
  useEffect(() => {
    if (isProcessing) {
      setStrokeParams(null);
      setFeatureBlock(null);
      setIndices(null);
      setEncoderActivations(null);
      setDecodedParams(null);
      setIsRendered(false);
    }
  }, [isProcessing]);

  // 启动流水线动画
  useEffect(() => {
    if (isProcessing && !pipelineStartedRef.current) {
      pipelineStartedRef.current = true;
      setCurrentStep('parsing');

      const steps: { step: PipelineStep; delay: number; action?: () => void }[] = [
        { step: 'parsing',    delay: 250, action: () => setStrokeParams(generateMockStrokeParams()) },
        { step: 'reshaping',  delay: 200, action: () => setFeatureBlock(generateMock6x8x8()) },
        { step: 'encoding',   delay: 300, action: () => setEncoderActivations(Array.from({ length: 8 }, () => Math.random())) },
        { step: 'quantizing', delay: 250, action: () => setIndices(generateMockIndices()) },
        { step: 'decoding',   delay: 250, action: () => setDecodedParams(generateMockStrokeParams()) },
        { step: 'rendering',  delay: 200, action: () => setIsRendered(true) },
        { step: 'complete',   delay: 50 },
      ];

      let totalDelay = 0;
      steps.forEach(({ step, delay, action }) => {
        setTimeout(() => { setCurrentStep(step); action?.(); }, totalDelay);
        totalDelay += delay;
      });
    }

    if (!isProcessing) {
      pipelineStartedRef.current = false;
    }
  }, [isProcessing]);

  const stepLabels: Record<PipelineStep, string> = {
    idle:       '等待输入',
    parsing:    '解析 SVG → 64×3 笔画参数',
    reshaping:  '空间重组 64×3 → 6×8×8',
    encoding:   'StrokeEncoder 卷积编码',
    quantizing: '向量量化 (查询 30K 码本)',
    decoding:   'StrokeDecoder 解码重建',
    rendering:  '渲染重建 SVG',
    complete:   '处理完成',
  };

  const stepOrder: PipelineStep[] = ['idle', 'parsing', 'reshaping', 'encoding', 'quantizing', 'decoding', 'rendering', 'complete'];

  const getStatus = (step: PipelineStep): 'pending' | 'active' | 'complete' => {
    const ci = stepOrder.indexOf(currentStep);
    const si = stepOrder.indexOf(step);
    if (si < ci) return 'complete';
    if (si === ci) return 'active';
    return 'pending';
  };

  const visibleSteps: PipelineStep[] = ['parsing', 'reshaping', 'encoding', 'quantizing', 'decoding', 'rendering'];

  return (
    <div className="pipeline-visualizer">
      <h3>Stage 1: Vectorization 流水线</h3>

      <div className="pipeline-steps">
        {visibleSteps.map((step, idx) => {
          const status = getStatus(step);
          return (
            <div key={step} className={`pipeline-step ${status}`}>
              <div className="step-number">{idx + 1}</div>
              <div className="step-label">{stepLabels[step].split(' ')[0]}</div>
            </div>
          );
        })}
      </div>

      <div className="current-step-info">
        <span className="step-indicator">
          {currentStep !== 'idle' && currentStep !== 'complete' ? '▶' : '●'}
        </span>
        <span>{stepLabels[currentStep]}</span>
      </div>

      <div className="data-visualization">
        {strokeParams && (
          <div className="data-block">
            <h4>笔画参数矩阵 (64×3)</h4>
            <div className="matrix-preview">
              <table>
                <thead>
                  <tr><th></th><th>x</th><th>y</th><th>w</th></tr>
                </thead>
                <tbody>
                  {strokeParams.slice(0, 5).map((row, i) => (
                    <tr key={i}>
                      <td className="row-label">[{i}]</td>
                      {row.map((val, j) => <td key={j}>{val.toFixed(1)}</td>)}
                    </tr>
                  ))}
                  <tr className="ellipsis-row"><td colSpan={4}>... (共 64 行)</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {featureBlock && (
          <div className="data-block">
            <h4>特征块 (6×8×8)</h4>
            <div className="feature-heatmap">
              {featureBlock.slice(0, 3).map((plane, c) => (
                <div key={c} className="feature-plane">
                  <span className="plane-label">C{c}</span>
                  <div className="heatmap-grid">
                    {plane.map((row, h) => (
                      <div key={h} className="heatmap-row">
                        {row.map((val, w) => (
                          <div key={w} className="heatmap-cell" style={{ backgroundColor: `rgba(102,126,234,${val})` }} />
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

        {encoderActivations && (
          <div className="data-block">
            <h4>Encoder 激活值</h4>
            <div className="activation-bars">
              {encoderActivations.map((val, i) => (
                <div key={i} className="activation-bar-container">
                  <div className="activation-bar" style={{ height: `${val * 100}%` }} />
                </div>
              ))}
            </div>
          </div>
        )}

        {indices && (
          <div className="data-block indices-matrix">
            <h4>笔画嵌入索引 (8×8)</h4>
            <p className="indices-desc">每个数字 ∈ [0, 29999]，对应码本中的一个向量</p>
            <div className="indices-grid">
              {indices.map((row, i) => (
                <div key={i} className="indices-row">
                  {row.map((val, j) => <div key={j} className="index-cell">{val}</div>)}
                </div>
              ))}
            </div>
            <p className="indices-note">这 64 个索引就是汉字的「基因序列」，将作为 Stage 2 的输入</p>
          </div>
        )}

        {decodedParams && (
          <div className="data-block decoded-params">
            <h4>解码重建参数 (64×3)</h4>
            <div className="matrix-preview">
              <table>
                <thead>
                  <tr><th></th><th>x&apos;</th><th>y&apos;</th><th>w&apos;</th></tr>
                </thead>
                <tbody>
                  {decodedParams.slice(0, 5).map((row, i) => (
                    <tr key={i}>
                      <td className="row-label">[{i}]</td>
                      {row.map((val, j) => <td key={j}>{val.toFixed(1)}</td>)}
                    </tr>
                  ))}
                  <tr className="ellipsis-row"><td colSpan={4}>... (共 64 行)</td></tr>
                </tbody>
              </table>
            </div>
            <p className="decode-note">与原始参数对比，存在微小量化误差</p>
          </div>
        )}

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
