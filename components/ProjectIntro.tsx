"use client";

import { useState } from 'react';

export function ProjectIntro() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="project-intro">
      <div className="intro-header" onClick={() => setExpanded(!expanded)}>
        <h3>LVGM-Style: 零样本矢量汉字生成</h3>
        <span className="toggle-icon">{expanded ? '−' : '+'}</span>
      </div>
      
      <div className={`intro-content ${expanded ? 'expanded' : ''}`}>
        {/* 研究背景 */}
        <section className="intro-section">
          <h4>研究背景</h4>
          <p>
            传统基于像素的汉字生成存在两大缺陷：放大模糊产生锯齿，无法用于工业印刷；
            缺乏对笔画几何结构的理解，常出现笔画缺失或粘连。
          </p>
        </section>

        {/* 核心创新 */}
        <section className="intro-section">
          <h4>核心创新</h4>
          <div className="innovation-grid">
            <div className="innovation-item">
              <span className="innovation-icon">1</span>
              <div>
                <strong>零样本风格迁移</strong>
                <p>仅需单字参考即可领悟笔锋、粗细等风格特征</p>
              </div>
            </div>
            <div className="innovation-item">
              <span className="innovation-icon">2</span>
              <div>
                <strong>两阶段解耦架构</strong>
                <p>Phase 1: 结构离散化 + 风格特征表征</p>
                <p>Phase 2: 自回归序列化 SVG 生成</p>
              </div>
            </div>
            <div className="innovation-item">
              <span className="innovation-icon">3</span>
              <div>
                <strong>工业级矢量输出</strong>
                <p>直接生成可编辑的 SVG 贝塞尔曲线路径</p>
              </div>
            </div>
          </div>
        </section>

        {/* 数据集 */}
        <section className="intro-section">
          <h4>数据集建设</h4>
          <div className="dataset-info">
            <div className="dataset-item">
              <strong>High-Fidelity 50</strong>
              <p>50 款高质量现代中文字体，涵盖不同字重与装饰风格</p>
            </div>
            <div className="dataset-item">
              <strong>工业级参考基准</strong>
              <p>思源宋体 / 思源黑体 2.0 作为拓扑真值参考</p>
            </div>
          </div>
        </section>

        {/* 当前版本 */}
        <div className="version-badge">
          v0.1 Beta - 基础重建测试版 | 多风格版本开发中
        </div>
      </div>
    </div>
  );
}
