"use client";

import { useState, useEffect, useCallback } from 'react';
import { HeroSection } from '@/components/HeroSection';
import { DatasetSection } from '@/components/DatasetSection';
import { BackgroundSection, MethodSection, InnovationSection, ResultsSection } from '@/components/PaperSections';
import { ControlPanel } from '@/components/ControlPanel';
import { SvgPreview } from '@/components/SvgPreview';
import { InfoCard } from '@/components/InfoCard';
import { PipelineVisualizer } from '@/components/PipelineVisualizer';
import { SvgExample, Manifest, SvgInfo } from '@/lib/types';

function parseSvgInfo(svgText: string, fileName: string): SvgInfo {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');
  const svg = doc.querySelector('svg');
  if (!svg) return { fileName, viewBox: null, width: null, height: null, pathCount: 0, elementCount: 0, hasStyle: false };
  return {
    fileName,
    viewBox: svg.getAttribute('viewBox'),
    width: svg.getAttribute('width'),
    height: svg.getAttribute('height'),
    pathCount: svg.querySelectorAll('path').length,
    elementCount: svg.querySelectorAll('*').length,
    hasStyle: svg.querySelector('style') !== null || svgText.includes('style='),
  };
}

export default function Home() {
  const [examples, setExamples] = useState<SvgExample[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('my_svgs');
  const [selectedExample, setSelectedExample] = useState<SvgExample | null>(null);
  const [inputText, setInputText] = useState('');
  const [originalSvg, setOriginalSvg] = useState<string | null>(null);
  const [generatedSvg, setGeneratedSvg] = useState<string | null>(null);
  const [originalInfo, setOriginalInfo] = useState<SvgInfo | null>(null);
  const [generatedInfo, setGeneratedInfo] = useState<SvgInfo | null>(null);
  const [isLoadingOriginal, setIsLoadingOriginal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/examples/manifest.json')
      .then((r) => r.json())
      .then((data: Manifest) => {
        setExamples(data.examples);
        const first = data.examples.find((e) => e.category === 'my_svgs');
        if (first) setSelectedExample(first);
      })
      .catch((err) => console.error('加载 manifest 失败:', err));
  }, []);

  const loadSvg = useCallback(async (example: SvgExample) => {
    setIsLoadingOriginal(true);
    setLoadError(null);
    try {
      const res = await fetch(example.svgPath);
      if (!res.ok) throw new Error(`加载失败: ${res.status}`);
      const svgText = await res.text();
      setOriginalSvg(svgText);
      setOriginalInfo(parseSvgInfo(svgText, example.svgPath.split('/').pop() || example.id));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : '加载 SVG 失败');
      setOriginalSvg(null);
      setOriginalInfo(null);
    } finally {
      setIsLoadingOriginal(false);
    }
  }, []);

  useEffect(() => {
    if (selectedExample) {
      loadSvg(selectedExample);
      setGeneratedSvg(null);
      setGeneratedInfo(null);
    }
  }, [selectedExample, loadSvg]);

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    const first = examples.find((e) => e.category === category);
    if (first) setSelectedExample(first);
  };

  const transformSvg = (svgText: string): string => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, 'image/svg+xml');
    const svg = doc.querySelector('svg');
    if (!svg) return svgText;
    svg.querySelectorAll('path').forEach((path) => {
      const d = path.getAttribute('d');
      if (d) {
        path.setAttribute('d', d.replace(/([0-9]+\.?[0-9]*)/g, (match) => {
          const num = parseFloat(match);
          return (num + num * (Math.random() * 0.03 - 0.015)).toFixed(2);
        }));
      }
    });
    svg.setAttribute('data-reconstructed', 'true');
    return new XMLSerializer().serializeToString(svg);
  };

  const handleGenerate = async () => {
    if (!selectedExample || !originalSvg) return;
    setIsGenerating(true);
    await new Promise((r) => setTimeout(r, 1500 + Math.random() * 500));
    try {
      const reconstructedSvg = transformSvg(originalSvg);
      setGeneratedSvg(reconstructedSvg);
      const fileName = selectedExample.svgPath.split('/').pop() || selectedExample.id;
      setGeneratedInfo(parseSvgInfo(reconstructedSvg, `${fileName} (重建)`));
    } catch (err) {
      console.error('Mock 生成失败:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const categories = [...new Set(examples.map((e) => e.category))];

  return (
    <div className="app">
      {/* Top: sticky nav + hero */}
      <HeroSection />

      {/* Paper content sections */}
      <div className="paper-content">
        <BackgroundSection />
        <DatasetSection />
        <MethodSection />
        <InnovationSection />
        <ResultsSection />

        {/* Demo section */}
        <section id="demo" className="content-section demo-section">
          <div className="section-label">Demo 演示</div>
          <h2 className="section-title">Stage 1: Vectorization 交互演示</h2>
          <p className="section-desc">
            选择一个示例字形，点击「生成」查看 VQ-VAE 编码 / 解码的完整流水线过程（当前为 Mock 演示，后续接入推理服务）。
          </p>

          <div className="demo-layout">
            <aside className="demo-sidebar">
              <ControlPanel
                categories={categories}
                selectedCategory={selectedCategory}
                onCategoryChange={handleCategoryChange}
                examples={examples}
                selectedExample={selectedExample}
                onExampleChange={setSelectedExample}
                inputText={inputText}
                onInputTextChange={setInputText}
                onGenerate={handleGenerate}
                isGenerating={isGenerating}
              />
              <div className="api-note">
                <h4>API 协议草案</h4>
                <pre>{`POST /api/generate
{
  "text": "一",
  "baseExampleId": "heng",
  "style": "kaishu"
}`}</pre>
              </div>
            </aside>

            <div className="demo-main">
              <div className="preview-row">
                <SvgPreview
                  title="原始 SVG (Original)"
                  svgContent={originalSvg}
                  isLoading={isLoadingOriginal}
                  error={loadError}
                  onRetry={() => selectedExample && loadSvg(selectedExample)}
                />
                <SvgPreview
                  title="生成结果 (Generated)"
                  svgContent={generatedSvg}
                  isLoading={isGenerating}
                  emptyText="点击「生成」按钮查看结果"
                />
              </div>
              <div className="info-row">
                <InfoCard info={originalInfo} title="原始 SVG 信息" />
                <InfoCard info={generatedInfo} title="生成 SVG 信息" />
              </div>
              <PipelineVisualizer isProcessing={isGenerating} svgContent={originalSvg} />
            </div>
          </div>
        </section>
      </div>

      <footer className="footer">
        <p>LVGM — Large Vector Graphics Model &nbsp;·&nbsp; 面向多风格的视觉引导式矢量字形大模型</p>
      </footer>
    </div>
  );
}
