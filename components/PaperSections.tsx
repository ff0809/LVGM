"use client";

export function BackgroundSection() {
  return (
    <section id="background" className="content-section">
      <div className="section-label">研究背景</div>
      <h2 className="section-title">为什么需要矢量字形生成？</h2>
      <p className="section-desc">
        中文字形设计是文化传承与视觉传达的核心载体。传统像素级字形生成存在分辨率依赖、
        笔画失真等固有缺陷，无法满足印刷、显示、文化创意等场景的工业级需求。
        现有矢量方法在<strong>多风格泛化</strong>与<strong>笔画语义控制</strong>方面仍存在显著瓶颈。
      </p>
      <div className="bg-cards">
        <div className="bg-card">
          <div className="bg-card-icon" style={{background:'#fef3c7',color:'#d97706'}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          </div>
          <div>
            <strong>像素生成的局限</strong>
            <p>分辨率固定，放大模糊，无法提取可编辑笔画路径</p>
          </div>
        </div>
        <div className="bg-card">
          <div className="bg-card-icon" style={{background:'#fee2e2',color:'#dc2626'}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/></svg>
          </div>
          <div>
            <strong>风格泛化困难</strong>
            <p>现有方法依赖大量同风格样本，零样本迁移效果差</p>
          </div>
        </div>
        <div className="bg-card">
          <div className="bg-card-icon" style={{background:'#ede9fe',color:'#7c3aed'}}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
          </div>
          <div>
            <strong>语义控制缺失</strong>
            <p>无法在笔画粒度上进行风格解耦与精细控制</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function MethodSection() {
  const steps = [
    { num: '1', title: 'Stage 1: Vectorization', desc: '将 SVG 汉字标准化为 64 个笔画段（64×3 矩阵），经 VQ-VAE 编码为 8×8 离散索引矩阵——字形的「基因序列」' },
    { num: '2', title: 'Stage 2: Generation', desc: '以基因序列为输入，经大语言模型（DeepSeek）自回归预测目标风格的索引序列，实现跨风格的语义迁移' },
    { num: '3', title: 'Stage 3: Rendering', desc: '将预测索引解码回 64×3 笔画参数，通过 DiffVG 可微渲染器重建高质量矢量 SVG 字形' },
  ];

  return (
    <section id="method" className="content-section">
      <div className="section-label">方法概述</div>
      <h2 className="section-title">两阶段解耦架构</h2>
      <p className="section-desc">
        LVGM 将字形生成分解为「矢量化」与「生成」两个阶段，通过向量量化桥接两个阶段，
        实现结构语义与风格信息的独立建模。
      </p>
      <div className="method-steps">
        {steps.map((s) => (
          <div key={s.num} className="method-step">
            <div className="method-step-num">{s.num}</div>
            <div className="method-step-body">
              <strong>{s.title}</strong>
              <p>{s.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function InnovationSection() {
  const items = [
    { icon: 'A', color: '#667eea', title: '零样本风格迁移', desc: '仅凭少量参考字形即可在未见风格上完成高质量字形生成，无需风格域微调' },
    { icon: 'B', color: '#764ba2', title: '两阶段解耦架构', desc: 'VQ-VAE 离散化表征将结构与风格信息独立建模，大幅降低生成空间复杂度' },
    { icon: 'C', color: '#22c55e', title: '可微矢量渲染', desc: '基于 DiffVG 的端到端可微渲染，输出符合工业印刷标准的 SVG 矢量字形' },
    { icon: 'D', color: '#f59e0b', title: '双轨高质量数据集', desc: '融合书法碑帖与商用字体的双轨数据集，覆盖楷/行/隶/草等多种书写风格' },
  ];

  return (
    <section id="innovation" className="content-section">
      <div className="section-label">创新点</div>
      <h2 className="section-title">核心贡献</h2>
      <div className="innovation-cards">
        {items.map((item) => (
          <div key={item.icon} className="innovation-card">
            <div className="inno-icon" style={{background: item.color}}>{item.icon}</div>
            <h4>{item.title}</h4>
            <p>{item.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ResultsSection() {
  return (
    <section id="results" className="content-section">
      <div className="section-label">实验结果</div>
      <h2 className="section-title">定量与定性评估</h2>
      <p className="section-desc">
        在多风格字形生成基准上，LVGM 在 FID、SSIM 和笔画准确率等指标上均优于当前 SOTA 方法，
        同时生成的矢量字形可直接用于印刷与排版流程。
      </p>
      <div className="results-grid">
        <div className="result-card">
          <div className="result-metric">FID ↓</div>
          <div className="result-value">18.4</div>
          <div className="result-note">较 SOTA 降低 23%</div>
        </div>
        <div className="result-card">
          <div className="result-metric">SSIM ↑</div>
          <div className="result-value">0.87</div>
          <div className="result-note">结构相似度</div>
        </div>
        <div className="result-card">
          <div className="result-metric">笔画准确率 ↑</div>
          <div className="result-value">91.2%</div>
          <div className="result-note">笔画语义保留</div>
        </div>
        <div className="result-card">
          <div className="result-metric">生成时间</div>
          <div className="result-value">~1.2s</div>
          <div className="result-note">单字形推理延迟</div>
        </div>
      </div>
      <p className="results-note">* 以上数值为当前阶段基准测试结果，后续版本持续优化中。</p>
    </section>
  );
}
