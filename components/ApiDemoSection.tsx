"use client";

import React, { useState } from 'react';

export function ApiDemoSection() {
  const [prompt, setPrompt] = useState('不');
  const [given, setGiven] = useState('1');
  const [temperature, setTemperature] = useState(0.9);
  const [topP, setTopP] = useState(0.9);
  
  const [loading, setLoading] = useState(false);
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ genTime: number; genTokens: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const response = await fetch('http://202.120.188.3:21789/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          given: given.trim() === '' ? 'all' : given,
          temperature,
          top_p: topP
        }),
      });

      const data = await response.json();
      
      if (response.ok && data.success) {
        setSvgContent(data.svg);
        setMeta({ genTime: data.gen_time, genTokens: data.gen_tokens });
      } else {
        setErrorMsg(data.detail || `请求失败，状态码: ${response.status}`);
      }
    } catch (err: any) {
      setErrorMsg(err.message || '网络连接失败，请检查后端服务是否正常运行或是否存在跨域(CORS)限制。');
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
        输入汉字，指定已知笔画数量，调用后端大模型实时生成矢量字形。黑色笔画为给定初始笔画，蓝色笔画为模型预测补全。
      </p>

      <div className="w-full max-w-6xl mx-auto p-6 bg-slate-50 rounded-2xl shadow-sm border border-slate-200/80 my-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Control Panel */}
          <div className="lg:col-span-5 space-y-6">
            {/* Prompt Input */}
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">输入汉字 (prompt)</label>
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg"
                placeholder="请输入汉字，如：不、云水"
              />
            </div>

            {/* Given Input */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="block text-sm font-semibold text-slate-700">已知笔画 (given)</label>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setGiven('all')}
                    className={`text-xs px-2 py-1 rounded transition ${given === 'all' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
                  >
                    智能全给
                  </button>
                  <button 
                    onClick={() => setGiven('1')}
                    className={`text-xs px-2 py-1 rounded transition ${given === '1' ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
                  >
                    只留首笔
                  </button>
                </div>
              </div>
              <input
                type="text"
                value={given}
                onChange={(e) => setGiven(e.target.value)}
                className="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
                placeholder="例如: 1 或 all,2 (留空默认为 all)"
              />
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                * 说明：数字代表提供前几笔。多字用逗号隔开（如：all,2 代表第一字全给，第二字给2笔）。
              </p>
            </div>

            {/* Advanced Sliders */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">高级采样参数</h3>
              <div>
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span>采样温度 (Temperature): <strong className="font-mono text-blue-600">{temperature}</strong></span>
                </div>
                <input
                  type="range" min="0.1" max="2.0" step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span>Nucleus 采样 (Top_p): <strong className="font-mono text-blue-600">{topP}</strong></span>
                </div>
                <input
                  type="range" min="0.0" max="1.0" step="0.05"
                  value={topP}
                  onChange={(e) => setTopP(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              onClick={handleGenerate}
              disabled={loading || !prompt}
              className={`w-full py-3.5 px-4 rounded-xl font-medium text-white shadow-md transition-all flex items-center justify-center gap-2 ${
                loading || !prompt 
                  ? 'bg-slate-400 cursor-not-allowed shadow-none' 
                  : 'bg-blue-600 hover:bg-blue-700 active:scale-[0.99]'
              }`}
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span>模型推理中 (预计 3~15 秒)...</span>
                </>
              ) : (
                <span>开始生成笔画</span>
              )}
            </button>

            {/* Error Display */}
            {errorMsg && (
              <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm break-all">
                <div className="font-semibold mb-1">⚠️ 出错了：</div>
                {errorMsg}
              </div>
            )}
          </div>

          {/* Right Canvas Area */}
          <div className="lg:col-span-7 flex flex-col h-full">
            <label className="block text-sm font-semibold text-slate-700 mb-2">SVG 渲染画布</label>
            <div className="flex-1 min-h-[380px] bg-white border border-slate-300/80 rounded-2xl shadow-inner relative overflow-hidden flex items-center justify-center p-8 pattern-mi-zi-ge">
              {/* Background Grid Lines (Mi-Zi-Ge emulation via pure CSS/elements) */}
              <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-slate-100 m-4 flex items-center justify-center">
                <div className="absolute w-full h-[1px] border-t border-dashed border-red-100/60" />
                <div className="absolute h-full w-[1px] border-l border-dashed border-red-100/60" />
                <div className="absolute w-full h-full border-t border-b border-dashed border-red-100/20 rotate-45 scale-150" />
                <div className="absolute w-full h-full border-t border-b border-dashed border-red-100/20 -rotate-45 scale-150" />
              </div>

              {/* SVG Content Injector */}
              {svgContent ? (
                <div 
                  className="w-full h-full max-w-[400px] max-h-[400px] flex items-center justify-center z-10 raw-svg-container"
                  dangerouslySetInnerHTML={{ __html: svgContent }}
                />
              ) : (
                <div className="text-center text-slate-400 z-10">
                  {loading ? (
                    <p className="animate-pulse">正在等待后端返回矢量数据...</p>
                  ) : (
                    <p>暂无生成内容，请在左侧配置参数并点击生成</p>
                  )}
                </div>
              )}
            </div>

            {/* Legend and Info Box */}
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4 bg-slate-100 p-3.5 rounded-xl border border-slate-200">
              <div className="flex gap-4 text-xs font-medium">
                <span className="flex items-center gap-1.5 text-slate-700">
                  <span className="w-3 h-3 bg-black rounded-sm inline-block" /> 黑色：用户给定笔画
                </span>
                <span className="flex items-center gap-1.5 text-blue-600">
                  <span className="w-3 h-3 bg-blue-500 rounded-sm inline-block" /> 蓝色：模型生成预测
                </span>
              </div>
              
              {meta && (
                <div className="flex gap-3 text-xs text-slate-500 font-mono bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-sm">
                  <span>⏱️ {meta.genTime}s</span>
                  <span>🪙 {meta.genTokens} tokens</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
