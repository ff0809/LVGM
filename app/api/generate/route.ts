import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // 在 Next.js 服务端（Node.js 环境）发起请求，绕过浏览器的 Mixed Content 限制
    const response = await fetch('http://202.120.188.3:21789/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    return NextResponse.json({ detail: error.message || '代理服务请求失败' }, { status: 500 });
  }
}
