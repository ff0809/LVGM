"use client";

import { useState, useEffect, useCallback } from 'react';
import { ControlPanel } from '@/components/ControlPanel';
import { SvgPreview } from '@/components/SvgPreview';
import { InfoCard } from '@/components/InfoCard';
import { PipelineVisualizer } from '@/components/PipelineVisualizer';
import { SvgExample, Manifest, SvgInfo } from '@/types';

// 解析 SVG 文本，提取信息
function parseSvgInfo(svgText: string, fileName: string): SvgInfo {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');
  const svg = doc.querySelector('svg');

  if (!svg) {
    return {
      fileName,
      viewBox: null,
      width: null,
      height: null,
      pathCount: 0,
      elementCount: 0,
      hasStyle: false,
    };
  }

  const viewBox = svg.getAttribute('viewBox');
  const width = svg.getAttribute('width');
  const height = svg.getAttribute('height');
  const pathCount = svg.querySelectorAll('path').length;
  const elementCount = svg.querySelectorAll('*').length;
  const hasStyle =
    svg.querySelector('style') !== null ||
    svgText.includes('style=') ||
    svgText.includes('<style');

  return {
    fileName,
    viewBox,
    width,
    height,
    pathCount,
    elementCount,
    hasStyle,
  };
}

// 安全地验证 SVG 路径是否来自本地 public 目录
function isValidSvgPath(path: string): boolean {
  return path.startsWith('/examples/') && path.endsWith('.svg');
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

  // 加载 manifest
  useEffect(() => {
    fetch('/examples/manifest.json')
      .then((res) => res.json())
      .then((data: Manifest) => {
        setExamples(data.examples);
        // 默认选择第一个 my_svgs 示例
        const first = data.examples.find((e) => e.category === 'my_svgs');
        if (first) {
          setSelectedExample(first);
        }
      })
      .catch((err) => {
        console.error('加载 manifest 失败:', err);
      });
  }, []);

  // 加载选中的 SVG
  const loadSvg = useCallback(async (example: SvgExample) => {
    if (!isValidSvgPath(example.svgPath)) {
      setLoadError('无效的 SVG 路径');
      return;
    }

    setIsLoadingOriginal(true);
    setLoadError(null);

    try {
      const res = await fetch(example.svgPath);
      if (!res.ok) {
        throw new Error(`加载失败: ${res.status}`);
      }
      const svgText = await res.text();
      setOriginalSvg(svgText);

      // 解析 SVG 信息
      const fileName = example.svgPath.split('/').pop() || example.id;
      setOriginalInfo(parseSvgInfo(svgText, fileName));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : '加载 SVG 失败');
      setOriginalSvg(null);
      setOriginalInfo(null);
    } finally {
      setIsLoadingOriginal(false);
    }
  }, []);

  // 当选中示例变化时加载 SVG
  useEffect(() => {
    if (selectedExample) {
      loadSvg(selectedExample);
      // 清除之前的生成结果
      setGeneratedSvg(null);
      setGeneratedInfo(null);
    }
  }, [selectedExample, loadSvg]);

  // 切换分类时，选择该分类的第一个示例
  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category);
    const first = examples.find((e) => e.category === category);
    if (first) {
      setSelectedExample(first);
    }
  };

  // Mock 生成函数
  const handleGenerate = async () => {
    if (!selectedExample) return;

    setIsGenerating(true);

    // 模拟 500-1200ms 的延迟
    const delay = Math.random() * 700 + 500;
    await new Promise((resolve) => setTimeout(resolve, delay));

    // 从同一分类中随机选择另一个 SVG 作为"生成结果"
    const sameCategory = examples.filter(
      (e) => e.category === selectedExample.category && e.id !== selectedExample.id
    );

    if (sameCategory.length === 0) {
      setIsGenerating(false);
      return;
    }

    const randomExample =
      sameCategory[Math.floor(Math.random() * sameCategory.length)];

    try {
      const res = await fetch(randomExample.svgPath);
      if (!res.ok) throw new Error('生成失败');
      const svgText = await res.text();
      setGeneratedSvg(svgText);

      const fileName = randomExample.svgPath.split('/').pop() || randomExample.id;
      setGeneratedInfo(parseSvgInfo(svgText, fileName));
    } catch (err) {
      console.error('Mock 生成失败:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  const categories = [...new Set(examples.map((e) => e.category))];

  return (
    <div className="app">
      <header className="header">
        <h1>LVGM SVG Demo</h1>
        <p className="subtitle">
          当前为 <strong>Mock 演示</strong>，后续可接推理服务
        </p>
      </header>

      <main className="main-content">
        <aside className="sidebar">
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
}

Response:
{
  "svgContent": "<svg>...</svg>",
  "processingTime": 1234,
  "generationId": "uuid"
}`}</pre>
          </div>
        </aside>

        <section className="preview-area">
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

          {/* Stage 1 流水线可视化 */}
          <PipelineVisualizer
            isProcessing={isGenerating}
            svgContent={originalSvg}
          />
        </section>
      </main>

      <footer className="footer">
        <p>LVGM - Large Vector Graphics Model | 矢量图形语言模型</p>
      </footer>
    </div>
  );
}
