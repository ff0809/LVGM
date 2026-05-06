"use client";

import { useState, useEffect } from 'react';

const NAV_ITEMS = [
  { id: 'background', label: '研究背景' },
  { id: 'dataset',    label: '数据集' },
  { id: 'method',     label: '方法概述' },
  { id: 'innovation', label: '创新点' },
  { id: 'results',    label: '实验结果' },
  { id: 'demo',       label: 'Demo 演示' },
];

export function HeroSection() {
  const [activeSection, setActiveSection] = useState('background');

  useEffect(() => {
    const handleScroll = () => {
      for (const item of NAV_ITEMS) {
        const el = document.getElementById(item.id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 120 && rect.bottom > 0) {
            setActiveSection(item.id);
            break;
          }
        }
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <>
      {/* Sticky Nav */}
      <nav className="sticky-nav">
        <div className="sticky-nav-inner">
          <span className="nav-logo">LVGM</span>
          <div className="nav-links">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                className={`nav-link${activeSection === item.id ? ' active' : ''}`}
                onClick={() => scrollTo(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <div className="hero">
        <div className="hero-inner">
          <div className="hero-tags">
            <span className="hero-tag tag-purple">arXiv 2024</span>
            <span className="hero-tag tag-blue">矢量字形生成</span>
            <span className="hero-tag tag-green">多风格迁移</span>
          </div>
          <h1 className="hero-title">
            面向多风格的视觉引导式<br />矢量字形大模型研究
          </h1>
          <p className="hero-subtitle">
            Large Vector Graphics Model for Style-Guided Chinese Glyph Generation
          </p>
          <div className="hero-actions">
            <a
              href="https://arxiv.org/abs/2511.11119"
              target="_blank"
              rel="noopener noreferrer"
              className="hero-btn btn-primary"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
              阅读论文
            </a>
            <a
              href="https://www.patyee.com/innovationSpace/searchDetail?exp=exp1778086815517&type=result&an=CN202511536703.0&pn=CN121010668B&index=1"
              target="_blank"
              rel="noopener noreferrer"
              className="hero-btn btn-secondary"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
              查看专利
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
