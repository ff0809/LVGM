"use client";

import { useState } from 'react';

const FONT_SOURCES = [
  { file: 'HYBaiQingTiJ.ttf',                name: '汉仪柏青简体',         type: '手写体 (美术字)',  charset: 'J, F, W, L', year: 2002 },
  { file: 'HYChangLiSongKeBen(Original)W.ttf',name: '汉仪昌黎宋刻本原版',   type: '印刷体 (雕版)',    charset: 'J, F, W, L', year: 2018 },
  { file: 'HYDaLiShuJ.ttf',                  name: '汉仪大隶书简体',       type: '书法体 (隶书)',    charset: 'J, F, W, L', year: 1996 },
  { file: 'HYDunHuangXieJingW.ttf',           name: '汉仪敦煌写经体',       type: '书法体 (古隶)',    charset: 'J, F, W, L', year: 2018 },
  { file: 'HYGuLiW.ttf',                     name: '汉仪古隶',             type: '书法体 (隶书)',    charset: 'J, F, W, L', year: 2019 },
  { file: 'HYShangWeiHeFengTiW.ttf',          name: '汉仪尚巍和风体',       type: '手写体 (行书)',    charset: 'J, F, W, L', year: 2020 },
  { file: 'HYShouJinShuJ.ttf',               name: '汉仪瘦金书简体',       type: '书法体 (行楷)',    charset: 'J, F, W, L', year: 2000 },
  { file: 'HYShuTongTiJ.ttf',                name: '汉仪舒同体简体',       type: '书法体 (行书)',    charset: 'J, F, W, L', year: 1996 },
  { file: 'HYWeiBeiJ.ttf',                   name: '汉仪魏碑简',           type: '印刷体 (魏楷)',    charset: 'J, F, W, L', year: 1996 },
  { file: 'HYYanHuShouShuW.ttf',             name: '汉仪彦湖手书体',       type: '手写体 (行书)',    charset: 'J, F, W, L', year: 2019 },
  { file: 'HYYanKaiW.ttf',                   name: '汉仪颜真卿楷体',       type: '书法体 (楷书)',    charset: 'J, F, W, L', year: 2019 },
  { file: 'HYZengXiangChanQuTiW.ttf',         name: '汉仪曾翔禅趣体',       type: '手写体 (隶楷)',    charset: 'J, F, W, L', year: 2020 },
  { file: 'HanyiSentyJournal.ttf',            name: '汉仪新蒂手札体',       type: '手写体 (行楷)',    charset: 'J, F, W, L', year: 2018 },
  { file: 'HanyiSentyZHAO.ttf',              name: '汉仪新蒂赵孟頫体',     type: '书法体 (行楷)',    charset: 'J, L',       year: 2016 },
  { file: 'FZSuXSHTWBLSJF.ttf',              name: '苏新诗好太王碑隶书',   type: '书法体 (隶楷)',    charset: 'K',          year: 2023 },
  { file: 'FZSXSLKJF.ttf',                   name: '苏新诗柳楷',           type: '书法体 (楷书)',    charset: 'K',          year: 2007 },
  { file: 'STFDBTYTFU.ttf',                  name: '书体坊颜真卿楷书',     type: '书法体 (楷书)',    charset: 'F',          year: 2019 },
  { file: 'STFHSJKJF.ttf',                   name: '书体坊何绍基楷书',     type: '书法体 (行楷)',    charset: 'K',          year: 2019 },
  { file: 'STFWangDXSJF.ttf',                name: '书体坊王铎行书',       type: '书法体 (行书)',    charset: 'K',          year: 2021 },
  { file: 'STFZhaoMFXKJF.ttf',               name: '书体坊赵孟頫行楷',     type: '书法体 (行楷)',    charset: 'K',          year: 2021 },
  { file: 'FZZJ-HLYHXSFU.ttf',               name: '方正字迹黄陵野鹤行书', type: '手写体 (行书)',    charset: 'F',          year: 2017 },
  { file: 'FZBaDSRXKJW.ttf',                 name: '方正八大山人行楷',     type: '书法体 (行楷)',    charset: 'J',          year: 2021 },
  { file: 'FZCaoQBLSJW.ttf',                 name: '方正曹全碑隶书',       type: '书法体 (隶书)',    charset: 'J',          year: 2023 },
  { file: 'FZChuSLKSJW.ttf',                 name: '方正褚遂良楷书',       type: '书法体 (楷书)',    charset: 'J',          year: 2021 },
  { file: 'FZCuanBZBKSJF.ttf',               name: '方正爨宝子碑楷书',     type: '书法体 (隶书)',    charset: 'K',          year: 2019 },
  { file: 'FZDongQCXSJW.ttf',                name: '方正董其昌行书',       type: '书法体 (行书)',    charset: 'J',          year: 2021 },
  { file: 'FZHaoTWBLSJW.ttf',                name: '方正好太王碑隶书',     type: '书法体 (隶楷)',    charset: 'J',          year: 2021 },
  { file: 'FZHuangTJXSJF.ttf',               name: '方正黄庭坚行书',       type: '书法体 (行书)',    charset: 'K',          year: 2020 },
  { file: 'FZLingFJXKJW.ttf',                name: '方正灵飞经小楷',       type: '书法体 (行楷)',    charset: 'J',          year: 2021 },
  { file: 'FZLiQBLSJF.ttf',                  name: '方正礼器碑隶书',       type: '书法体 (隶书)',    charset: 'K',          year: 2023 },
  { file: 'FZLiuBSLSJF.ttf',                 name: '方正刘炳森隶书',       type: '书法体 (隶书)',    charset: 'K',          year: 2019 },
  { file: 'FZLiuGQKSJF.ttf',                 name: '方正柳公权楷书',       type: '书法体 (楷书)',    charset: 'K',          year: 2019 },
  { file: 'FZLiYXSJW.ttf',                   name: '方正李邕行书',         type: '书法体 (行书)',    charset: 'J',          year: 2021 },
  { file: 'FZLuXXSJF.ttf',                   name: '方正鲁迅行书',         type: '书法体 (行书)',    charset: 'K',          year: 2019 },
  { file: 'FZMiFXSJW.ttf',                   name: '方正米芾行书',         type: '书法体 (行书)',    charset: 'J',          year: 2021 },
  { file: 'FZOuYXKSJF.ttf',                  name: '方正欧阳询楷书',       type: '书法体 (楷书)',    charset: 'K',          year: 2023 },
  { file: 'FZOuYZSXSJF.ttf',                 name: '方正欧阳中石行书',     type: '书法体 (行书)',    charset: 'K',          year: 2023 },
  { file: 'FZQiGXKJF.ttf',                   name: '方正启功行楷',         type: '书法体 (行楷)',    charset: 'K',          year: 2019 },
  { file: 'FZShenYMXSJF.ttf',                name: '方正沈尹默行书',       type: '书法体 (行书)',    charset: 'K',          year: 2019 },
  { file: 'FZSHiMMKSJW.ttf',                 name: '方正石门铭楷书',       type: '书法体 (隶楷)',    charset: 'J',          year: 2021 },
  { file: 'FZShiMSLSJW.ttf',                 name: '方正石门颂隶书',       type: '书法体 (隶书)',    charset: 'J',          year: 2021 },
  { file: 'FZShuTXSJF.ttf',                  name: '方正舒同行书',         type: '书法体 (行书)',    charset: 'K',          year: 2020 },
  { file: 'FZSuSXSJF.ttf',                   name: '方正苏轼行书',         type: '书法体 (行书)',    charset: 'K',          year: 2020 },
  { file: 'FZTaiSJGJLSJF.ttf',               name: '方正泰山金刚经隶书',   type: '书法体 (隶楷)',    charset: 'K',          year: 2021 },
  { file: 'FZWangDXCJF.ttf',                 name: '方正王铎行草',         type: '书法体 (行草)',    charset: 'K',          year: 2019 },
  { file: 'FZWangXZXKJW.ttf',                name: '方正王献之小楷',       type: '书法体 (楷书)',    charset: 'J',          year: 2021 },
  { file: 'FZWangXZXSJF.ttf',                name: '方正王羲之行书',       type: '书法体 (行书)',    charset: 'K',          year: 2023 },
  { file: 'FZWenZMXCJF.ttf',                 name: '方正文征明行草',       type: '书法体 (行草)',    charset: 'K',          year: 2020 },
  { file: 'FZWenZMXKJW.ttf',                 name: '方正文征明小楷',       type: '书法体 (行楷)',    charset: 'J',          year: 2021 },
  { file: 'FZWuYRXSJF.ttf',                  name: '方正吴玉如行书',       type: '书法体 (行书)',    charset: 'K',          year: 2020 },
  { file: 'FZXiPSJLSJF.ttf',                 name: '方正熹平石经隶书',     type: '书法体 (隶书)',    charset: 'K',          year: 2023 },
  { file: 'FZXiXSLSJW.ttf',                  name: '方正西狭颂隶书',       type: '书法体 (隶书)',    charset: 'J',          year: 2021 },
  { file: 'FZYangNSXSJW.ttf',                name: '方正杨凝式行书',       type: '书法体 (行楷)',    charset: 'J',          year: 2021 },
  { file: 'FZYanZQKSJF.ttf',                 name: '方正颜真卿楷书',       type: '书法体 (楷书)',    charset: 'K',          year: 2020 },
  { file: 'FZYiBSLSJW.ttf',                  name: '方正伊秉绶隶书',       type: '书法体 (隶书)',    charset: 'J',          year: 2023 },
  { file: 'FZYiYBLSJW.ttf',                  name: '方正乙瑛碑隶书',       type: '书法体 (隶书)',    charset: 'J',          year: 2021 },
  { file: 'FZZhangMLBKSJW.ttf',              name: '方正张猛龙碑楷书',     type: '书法体 (魏楷)',    charset: 'J',          year: 2021 },
  { file: 'FZZhangQBLSJW.ttf',               name: '方正张迁碑隶书',       type: '书法体 (隶书)',    charset: 'J',          year: 2023 },
  { file: 'FZZhaoJSJSJF.ttf',                name: '方正赵佶瘦金书',       type: '书法体 (行楷)',    charset: 'J, K',       year: 2020 },
  { file: 'FZZhaoMFKSJF.ttf',                name: '方正赵孟頫楷书',       type: '书法体 (行楷)',    charset: 'J, K',       year: 2020 },
  { file: 'FZZhaoMFXSJF.ttf',                name: '方正赵孟頫行书',       type: '书法体 (行书)',    charset: 'J, K',       year: 2020 },
  { file: 'FZZHengWGBKSJW.ttf',              name: '方正郑文公碑楷书',     type: '书法体 (隶楷)',    charset: 'J',          year: 2021 },
  { file: 'FZZhiYKSJW.ttf',                  name: '方正智永楷书',         type: '书法体 (行楷)',    charset: 'J',          year: 2023 },
];

// 按字体品牌分组
const BRAND_GROUPS = [
  { brand: '汉仪字库 (HY)',  prefix: ['HY', 'Hanyi'],  color: '#667eea' },
  { brand: '苏新诗 / 书体坊', prefix: ['FZSuX', 'FZSX', 'STF'], color: '#764ba2' },
  { brand: '方正字库 (FZ)',  prefix: ['FZ', 'FZZJ'],  color: '#22c55e' },
];

export function DatasetSection() {
  const [search, setSearch] = useState('');

  const filtered = FONT_SOURCES.filter(
    (f) =>
      f.file.toLowerCase().includes(search.toLowerCase()) ||
      f.name.includes(search) ||
      f.type.includes(search)
  );

  const hyFonts = FONT_SOURCES.filter(f => f.file.startsWith('HY') || f.file.startsWith('Hanyi')).length;
  const stfFonts = FONT_SOURCES.filter(f => f.file.startsWith('STF') || f.file.startsWith('FZSuX') || f.file.startsWith('FZSX')).length;
  const fzFonts = FONT_SOURCES.filter(f => f.file.startsWith('FZ') && !f.file.startsWith('FZSuX') && !f.file.startsWith('FZSX')).length;

  return (
    <section id="dataset" className="content-section">
      <div className="section-label">数据集</div>
      <h2 className="section-title">
        数据来源 <span className="section-title-en">Data Collection</span>
      </h2>
      <p className="section-desc">
        收录来自汉仪、方正、书体坊等主流字库厂商的 <strong>{FONT_SOURCES.length} 款</strong>商用书法字体，
        涵盖楷书、行书、隶书、行楷、行草等多种书写风格，覆盖从古典碑帖到当代书法的广泛风格谱系，
        共提供超过 <strong>390,000 张</strong>高质量矢量字形样本。
      </p>

      {/* 统计卡片 */}
      <div className="dataset-stats">
        <div className="dataset-stat-card" style={{ borderColor: '#667eea' }}>
          <div className="stat-num" style={{ color: '#667eea' }}>{hyFonts}</div>
          <div className="stat-label">汉仪字库</div>
        </div>
        <div className="dataset-stat-card" style={{ borderColor: '#764ba2' }}>
          <div className="stat-num" style={{ color: '#764ba2' }}>{stfFonts}</div>
          <div className="stat-label">苏新诗 / 书体坊</div>
        </div>
        <div className="dataset-stat-card" style={{ borderColor: '#22c55e' }}>
          <div className="stat-num" style={{ color: '#22c55e' }}>{fzFonts}</div>
          <div className="stat-label">方正字库</div>
        </div>
        <div className="dataset-stat-card" style={{ borderColor: '#f59e0b' }}>
          <div className="stat-num" style={{ color: '#f59e0b' }}>{FONT_SOURCES.length}</div>
          <div className="stat-label">字体总数</div>
        </div>
      </div>

      {/* 版权声明 */}
      <div className="fonts-notice">
        Fonts downloaded from the Internet are only for personal study and research. Font products are the crystals
        created by type designers, who should enjoy copyrights. You could use the products for commercial purposes
        only after license be authorized successfully.<br />
        <span style={{ color: '#555' }}>所有字体仅供个人学习、研究、欣赏。如需商用，务必提前获得相应授权。</span>
      </div>

      {/* 搜索栏 */}
      <div className="fonts-search-bar">
        <input
          type="text"
          placeholder="搜索字体名称、风格类型..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="fonts-search-input"
        />
        <span className="fonts-search-count">显示 {filtered.length} / {FONT_SOURCES.length} 款</span>
      </div>

      {/* 字体表格 */}
      <div className="fonts-table-wrapper">
        <table className="fonts-table">
          <thead>
            <tr>
              <th>Font list</th>
              <th>Font name</th>
              <th>Type</th>
              <th>Charset</th>
              <th>Format</th>
              <th>Year</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((f) => {
              const isHY = f.file.startsWith('HY') || f.file.startsWith('Hanyi');
              const isSTF = f.file.startsWith('STF') || f.file.startsWith('FZSuX') || f.file.startsWith('FZSX');
              const brandColor = isHY ? '#667eea' : isSTF ? '#764ba2' : '#22c55e';
              return (
                <tr key={f.file}>
                  <td className="font-file">
                    <span className="brand-dot" style={{ background: brandColor }} />
                    {f.file}
                  </td>
                  <td className="font-name-cn">{f.name}</td>
                  <td>
                    <span className="type-badge">{f.type}</span>
                  </td>
                  <td className="font-charset">{f.charset}</td>
                  <td className="font-format">OTF, TTF</td>
                  <td className="font-year">{f.year}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
