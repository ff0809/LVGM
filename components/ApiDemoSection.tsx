"use client";

import React, { useState } from 'react';

const PRESETS = [
  {
    id: 'blind',
    label: '全盲盒预测',
    desc: '每字仅留首笔，模型完全自由发挥',
    icon: '✦',
    color: 'from-violet-500 to-purple-600',
    build: (len: number) => Array(len || 1).fill('1').join(','),
  },
  {
    id: 'last',
    label: '最后一字补全',
    desc: '前面全给，只预测最后一字结构',
    icon: '◎',
    color: 'from-sky-500 to-indigo-500',
    build: (len: number) => {
      if (len <= 1) return '1';
      return [...Array(len - 1).fill('all'), '1'].join(',');
    },
  },
  {
    id: 'standard',
    label: '标准字形',
    desc: '全部给全，后端自动分配',
    icon: '▣',
    color: 'from-teal-500 to-emerald-500',
    build: () => '',
  },
];

export function ApiDemoSection() {
  const [prompt, setPrompt] = useState('不');
  const [given, setGiven] = useState('1');
  const [activePreset, setActivePreset] = useState<string | null>('blind');
  const [temperature, setTemperature] = useState(0.9);
  const [topP, setTopP] = useState(0.9);

  const [loading, setLoading] = useState(false);
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ genTime: number; genTokens: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const applyPreset = (preset: typeof PRESETS[0]) => {
    const len = prompt.trim().length || 1;
    const val = preset.build(len);
    setGiven(val);
    setActivePreset(preset.id);
  };

  const handleGenerate = async () => {
    setLoading(true);
    setSvgContent(null);
    setMeta(null);
    setErrorMsg(null);
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          ...(given.trim() !== '' ? { given: given.trim() } : {}),
          temperature,
          top_p: topP,
        }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        setSvgContent(data.svg);
        setMeta({ genTime: data.gen_time, genTokens: data.gen_tokens });
      } else {
        setErrorMsg(data.detail || `请求失败，状态码: ${response.status}`);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : '网络连接失败，请检查后端服务是否正常运行。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="demo" className="content-section">
      <div className="section-label">在线演示</div>
      <h2 className="section-title">
        LVGM 汉字生成演示
        <span className="section-title-en">Interactive Demo</span>
      </h2>
      <p className="section-desc">
        输入汉字，选择预设策略，调用后端大模型实时生成矢量字形。黑色笔画为给定初始笔画，蓝色笔画为模型预测补全。
      </p>

      <div className="w-full max-w-6xl mx-auto my-8 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="grid grid-cols-1 lg:grid-cols-5">

          {/* ── Left Control Panel ── */}
          <div className="lg:col-span-2 border-r border-slate-200 p-6 space-y-6 bg-slate-50/60">

            {/* Prompt */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                输入汉字 · Prompt
              </label>
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-2xl font-medium text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-400 transition"
                placeholder="输入汉字，如：不、云水"
              />
            </div>

            {/* Smart Presets */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">
                智能笔画预设 · Smart Presets
              </label>
              <div className="space-y-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => applyPreset(p)}
                    className={`w-full text-left px-4 py-3 rounded-xl border transition-all flex items-start gap-3 ${
                      activePreset === p.id
                        ? 'border-violet-300 bg-violet-50 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-violet-200 hover:bg-violet-50/40'
                    }`}
                  >
                    <span className={`mt-0.5 w-7 h-7 rounded-lg bg-gradient-to-br ${p.color} text-white flex items-center justify-center text-sm flex-shrink-0`}>
                      {p.icon}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-slate-700">{p.label}</span>
                      <span className="block text-xs text-slate-400 mt-0.5">{p.desc}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Manual given override */}
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                已知笔画值 · Given
              </label>
              <input
                type="text"
                value={given}
                onChange={(e) => { setGiven(e.target.value); setActivePreset(null); }}
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-sm font-mono shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-violet-400 transition"
                placeholder="留空 = all，如：1 或 all,2,1"
              />
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                数字代表给定前几笔；多字用逗号隔开；留空后端自动 all。
              </p>
            </div>

            {/* Advanced Sliders */}
            <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-5">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">高级采样参数</h3>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-slate-600">Temperature</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">标准 0.5 · 艺术 1.0</span>
                    <span className="w-10 text-center text-xs font-mono font-bold text-violet-600 bg-violet-50 border border-violet-200 rounded px-1 py-0.5">
                      {temperature.toFixed(1)}
                    </span>
                  </div>
                </div>
                <input type="range" min="0.1" max="2.0" step="0.1" value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-violet-600 bg-slate-200"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs text-slate-600">Top-p</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">精准 0.7 · 多样 0.95</span>
                    <span className="w-10 text-center text-xs font-mono font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 rounded px-1 py-0.5">
                      {topP.toFixed(2)}
                    </span>
                  </div>
                </div>
                <input type="range" min="0.0" max="1.0" step="0.05" value={topP}
                  onChange={(e) => setTopP(parseFloat(e.target.value))}
                  className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-indigo-600 bg-slate-200"
                />
              </div>
            </div>

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={loading || !prompt.trim()}
              className={`w-full py-3.5 rounded-xl font-semibold text-sm text-white shadow-md transition-all flex items-center justify-center gap-2 ${
                loading || !prompt.trim()
                  ? 'bg-slate-400 cursor-not-allowed shadow-none'
                  : 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 active:scale-[0.99]'
              }`}
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  模型推理中 (预计 3~15 秒)...
                </>
              ) : (
                '开始生成笔画'
              )}
            </button>

            {errorMsg && (
              <div className="p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs break-all leading-relaxed">
                <span className="font-semibold block mb-1">出错了：</span>
                {errorMsg}
              </div>
            )}
          </div>

          {/* ── Right Canvas Area ── */}
          <div className="lg:col-span-3 p-6 flex flex-col gap-4">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">
              SVG 渲染画布 · Canvas
            </label>

            <div className="flex-1 min-h-[400px] bg-white border border-slate-200 rounded-2xl shadow-inner relative overflow-hidden flex items-center justify-center">
              {/* Mi-zi-ge grid */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 border-2 border-dashed border-slate-100 m-6" />
                <div className="absolute top-1/2 left-0 right-0 h-px border-t border-dashed border-red-200/50" />
                <div className="absolute left-1/2 top-0 bottom-0 w-px border-l border-dashed border-red-200/50" />
                <div className="absolute inset-0 flex items-center justify-center opacity-10">
                  <div className="w-full h-px bg-red-300 rotate-45 scale-150" />
                </div>
                <div className="absolute inset-0 flex items-center justify-center opacity-10">
                  <div className="w-full h-px bg-red-300 -rotate-45 scale-150" />
                </div>
              </div>

              {svgContent ? (
                <div
                  className="relative z-10 w-full h-full flex items-center justify-center p-8"
                  style={{ maxWidth: 440, maxHeight: 440, margin: 'auto' }}
                  dangerouslySetInnerHTML={{ __html: svgContent }}
                />
              ) : (
                <p className="relative z-10 text-sm text-slate-400 text-center px-8">
                  {loading
                    ? '正在等待后端返回矢量数据...'
                    : '在左侧配置参数后点击「开始生成笔画」'}
                </p>
              )}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-4 text-xs font-medium text-slate-600">
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-sm bg-slate-900 inline-block" />
                  黑色：用户给定笔画
                </span>
                <span className="flex items-center gap-1.5 text-blue-600">
                  <span className="w-3 h-3 rounded-sm bg-blue-500 inline-block" />
                  蓝色：模型生成预测
                </span>
              </div>

              {meta && (
                <div className="flex gap-2">
                  <span className="inline-flex items-center gap-1 text-xs font-mono text-slate-600 bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm">
                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                    </svg>
                    {meta.genTime}s
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-mono text-slate-600 bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 shadow-sm">
                    <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 9h6M9 12h6M9 15h4" />
                    </svg>
                    {meta.genTokens} tokens
                  </span>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
