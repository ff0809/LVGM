"use client";

import { useState } from 'react';

const CALLIGRAPHY_SOURCES = [
  { count: 233,  name: '宣示表', author: '钟繇', desc: '小楷，楷书性书法史成熟代表作，点画遒劲朴茂，字形宽博端方，极具安平朴厚书风魅力。真道不传，行天不扶本，为古代小楷范本，深受历代二王及后生者欢迎。' },
  { count: 587,  name: '东方朔画赞', author: '颜真卿', desc: '唐天宝十三年（754年）作，颜真卿早年书写代表作，话体浓博书水，笔画遒劲扎，邦放有方，中锋运笔形态各异，蔚著之英正既形塑颜体典型风格。' },
  { count: 167,  name: '麻姑仙坛记', author: '颜真卿', desc: '唐调剂联邦则同公利，中带刚笔，宏落用笔，有行笔力。行笔力于胆识，初享知见觉其情，绑在形形颜真卿成熟颜体风格之代表作。' },
  { count: 1037, name: '自书告身帖', author: '颜真卿', desc: '颜真卿晚年书法，以行楷书写，笔力遒劲苍老，既古典浑朴，已达到了大气天人、气魄公允、力道厚重的年迈报复作。' },
  { count: 2479, name: '灵飞经', author: '传钟绍京', desc: '小楷，作为唐代优质小字书，笔划风格变化，以新行柔完全，且四明自然流淌，分别提取所得，笔法宽宏润适，为历代习小楷必读范本。' },
  { count: 234,  name: '教弟子言', author: '柳公权', desc: '信件，融合了明净清俊特点，坚方劲道，由行楷相结，以行楷相综合了自己的书法楷书结字特完整了行书刚润兼顾，运速庐守序的艺术特点。' },
  { count: 75,   name: '山堂诗帖', author: '蔡襄', desc: '行书，北宋熙宁十年（1067年），书法巨人，来源明细出，颜真卿，志百合的情怀，行书的诠释，求取秀出笔，天真心迷，为颜藏学书字特殊之作。' },
  { count: 68,   name: '归去来兮', author: '苏轼', desc: '行楷书行文，笔形方正丰满，整笔分明，刀笔心上，中实颜楷，上引书楷，力入书楷书方正绕行，书道行石提在图整楷写字清晰之作。' },
  { count: 391,  name: '醉翁亭记', author: '苏轼', desc: '兼有行厚、敦敦楷情、苏轼特书，字形力画蓬勃结构，外圆内虚，形式化在草；笔划到特综倡宣颜笔意义之，文字与书法互辉捧，结构分格。' },
  { count: 40,   name: '寒山子庵居士诗帖', author: '黄庭坚', desc: '行书，又处《同时按比利两线草》，笔画线综综起两倡稳，笔画如之/无穿透，体现将行书中中合收放，竖开开明奶的流行结构结构特征。' },
  { count: 105,  name: '松风阁诗帖', author: '黄庭坚', desc: '行书。（1102年），代表了北宋代……' },
];

const FONT_SOURCES = [
  { file: 'HYBaiQingTiJ.ttf',              name: '汉仪柏青简体',        type: '手写体(美术字)', year: 2002 },
  { file: 'HYChangLiSongKeBen(Original)W.ttf', name: '汉仪昌黎宋刻本原版', type: '印刷体(离版)',   year: 2018 },
  { file: 'HYDaLiShuJ.ttf',                name: '汉仪大隶书简体',      type: '书法体(隶书)',   year: 1996 },
  { file: 'HYDunHuangXieJingW.ttf',        name: '汉仪敦煌写经体',      type: '书法体(古隶)',   year: 2018 },
  { file: 'HYGuLiW.ttf',                   name: '汉仪古隶',            type: '书法体(隶书)',   year: 2019 },
  { file: 'HYShangWeiHeFengTiW.ttf',       name: '汉仪尚巍和风体',      type: '手写体(行书)',   year: 2020 },
  { file: 'HYShouJinShuJ.ttf',             name: '汉仪瘦金书简体',      type: '书法体(行楷)',   year: 2000 },
  { file: 'HYShuTongTiJ.ttf',              name: '汉仪舒同体简体',      type: '手写体(行书)',   year: 1996 },
  { file: 'HYWeiBeiJ.ttf',                 name: '汉仪魏碑简',          type: '印刷体(魏楷)',   year: 1996 },
  { file: 'HYYanHuShouShuW.ttf',           name: '汉仪彦湖手书体',      type: '手写体(行书)',   year: 2019 },
];

export function DatasetSection() {
  const [tab, setTab] = useState<'calligraphy' | 'fonts'>('calligraphy');

  return (
    <section id="dataset" className="content-section">
      <div className="section-label">数据集</div>
      <h2 className="section-title">数据来源 <span className="section-title-en">Data Collection</span></h2>
      <p className="section-desc">
        构建了包含书法碑帖与现代汉字字体的双轨数据集。书法子集来源于历代名家真迹碑帖，
        涵盖楷、行、隶、草各体；字体子集收录工业级 HY 系列字体，覆盖多种印刷与手写风格，
        总计提供超过 <strong>15,000 张</strong>高质量矢量字形样本。
      </p>

      {/* Tabs */}
      <div className="dataset-tabs">
        <button
          className={`dataset-tab${tab === 'calligraphy' ? ' active' : ''}`}
          onClick={() => setTab('calligraphy')}
        >
          书法碑帖来源 &nbsp;<span className="tab-count">30 帖 · 15,093 张</span>
        </button>
        <button
          className={`dataset-tab${tab === 'fonts' ? ' active' : ''}`}
          onClick={() => setTab('fonts')}
        >
          商用字体来源 &nbsp;<span className="tab-count">10 款 · 460 种</span>
        </button>
      </div>

      {tab === 'calligraphy' && (
        <div className="calligraphy-grid">
          {CALLIGRAPHY_SOURCES.map((item) => (
            <div key={item.name} className="calligraphy-card">
              <div className="calligraphy-count">{item.count}</div>
              <div className="calligraphy-info">
                <h4>{item.name}<span className="calligraphy-author">（{item.author}）</span></h4>
                <p>{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'fonts' && (
        <div className="fonts-wrapper">
          <p className="fonts-notice">
            所有字体仅供个人学习、研究、欣赏。如需商用，务必提前获得相应授权。
          </p>
          <table className="fonts-table">
            <thead>
              <tr>
                <th>Font list</th>
                <th>Font name</th>
                <th>Type</th>
                <th>Format</th>
                <th>Year</th>
              </tr>
            </thead>
            <tbody>
              {FONT_SOURCES.map((f) => (
                <tr key={f.file}>
                  <td className="font-file">{f.file}</td>
                  <td>{f.name}</td>
                  <td>{f.type}</td>
                  <td>OTF, TTF</td>
                  <td>{f.year}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
