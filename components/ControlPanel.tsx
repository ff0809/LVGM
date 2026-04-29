"use client";

import { SvgExample } from '@/types';

interface ControlPanelProps {
  categories: string[];
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  examples: SvgExample[];
  selectedExample: SvgExample | null;
  onExampleChange: (example: SvgExample) => void;
  inputText: string;
  onInputTextChange: (text: string) => void;
  onGenerate: () => void;
  isGenerating: boolean;
}

export function ControlPanel({
  categories,
  selectedCategory,
  onCategoryChange,
  examples,
  selectedExample,
  onExampleChange,
  inputText,
  onInputTextChange,
  onGenerate,
  isGenerating,
}: ControlPanelProps) {
  const filteredExamples = examples.filter(
    (e) => e.category === selectedCategory
  );

  return (
    <div className="control-panel">
      <h2>控制面板</h2>

      <div className="control-group">
        <label htmlFor="category">分类 (Category)</label>
        <select
          id="category"
          value={selectedCategory}
          onChange={(e) => onCategoryChange(e.target.value)}
        >
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat === 'my_svgs' ? '书法笔画 (Calligraphy)' : 'DiffVG 图形'}
            </option>
          ))}
        </select>
      </div>

      <div className="control-group">
        <label htmlFor="example">示例 (Example)</label>
        <select
          id="example"
          value={selectedExample?.id || ''}
          onChange={(e) => {
            const example = filteredExamples.find((ex) => ex.id === e.target.value);
            if (example) onExampleChange(example);
          }}
        >
          <option value="" disabled>
            请选择...
          </option>
          {filteredExamples.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.label}
            </option>
          ))}
        </select>
      </div>

      <div className="control-group">
        <label htmlFor="text">文本输入 (可选)</label>
        <input
          id="text"
          type="text"
          placeholder="输入文字，仅用于展示..."
          value={inputText}
          onChange={(e) => onInputTextChange(e.target.value)}
        />
        <small className="hint">此字段仅用于展示，Mock 模式下不做真实生成</small>
      </div>

      <button
        className="generate-btn"
        onClick={onGenerate}
        disabled={isGenerating || !selectedExample}
      >
        {isGenerating ? '生成中...' : '生成 (Generate)'}
      </button>
    </div>
  );
}
