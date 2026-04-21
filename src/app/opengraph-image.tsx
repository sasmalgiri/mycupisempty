import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'MyCupIsEmpty - AI-Powered Adaptive Learning Platform';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #7c3aed 0%, #2563eb 50%, #06b6d4 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '24px',
            marginBottom: '40px',
          }}
        >
          <div
            style={{
              width: '100px',
              height: '100px',
              borderRadius: '24px',
              background: 'rgba(255,255,255,0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '60px',
            }}
          >
            🧠
          </div>
          <div
            style={{
              fontSize: '64px',
              fontWeight: 800,
              color: 'white',
              letterSpacing: '-2px',
            }}
          >
            MyCupIsEmpty
          </div>
        </div>

        <div
          style={{
            fontSize: '28px',
            color: 'rgba(255,255,255,0.9)',
            textAlign: 'center',
            maxWidth: '800px',
            lineHeight: 1.4,
          }}
        >
          AI-Powered Adaptive Learning for Indian Students
        </div>

        <div
          style={{
            display: 'flex',
            gap: '16px',
            marginTop: '40px',
          }}
        >
          {['Class 1–12', '20+ Methods', 'AI Tutor', 'Free'].map((tag) => (
            <div
              key={tag}
              style={{
                background: 'rgba(255,255,255,0.2)',
                borderRadius: '999px',
                padding: '10px 24px',
                color: 'white',
                fontSize: '18px',
                fontWeight: 600,
              }}
            >
              {tag}
            </div>
          ))}
        </div>

        <div
          style={{
            position: 'absolute',
            bottom: '30px',
            fontSize: '18px',
            color: 'rgba(255,255,255,0.6)',
          }}
        >
          mycupisempty.com — Every student can learn, in their own way
        </div>
      </div>
    ),
    { ...size }
  );
}
