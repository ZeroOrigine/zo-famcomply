// CANONICAL: serves the 1200x630 Open Graph image at /og.png, matching the og:image URL
// declared in app/layout.tsx metadata. Rendered with next/og so a real PNG resolves at this
// path without committing a binary asset to the repo. (QA-037)
import { ImageResponse } from 'next/og'

export const runtime = 'edge'

const STEPS = ['CPR', 'First aid', 'Background check', 'Inspection prep', 'License renewal']

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '64px',
          backgroundColor: '#0f172a',
          backgroundImage: 'linear-gradient(135deg, #0f172a 0%, #115e59 100%)',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '64px',
              height: '64px',
              borderRadius: '16px',
              backgroundColor: '#2dd4bf',
              color: '#0f172a',
              fontSize: '38px',
              fontWeight: 700,
            }}
          >
            F
          </div>
          <div style={{ display: 'flex', marginLeft: '20px', color: '#ffffff', fontSize: '40px', fontWeight: 700 }}>
            FamComply
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', color: '#ffffff', fontSize: '64px', fontWeight: 700, lineHeight: 1.15 }}>
            License renewals in the right order
          </div>
          <div style={{ display: 'flex', marginTop: '20px', color: '#99f6e4', fontSize: '28px', lineHeight: 1.4 }}>
            A sequenced renewal timeline for family child care providers, with reminders before every deadline.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center' }}>
          {STEPS.map((step, index) => (
            <div key={step} style={{ display: 'flex', alignItems: 'center' }}>
              {index > 0 ? (
                <div style={{ display: 'flex', width: '18px', height: '3px', backgroundColor: '#2dd4bf', margin: '0 10px' }} />
              ) : null}
              <div
                style={{
                  display: 'flex',
                  padding: '10px 18px',
                  borderRadius: '9999px',
                  border: '2px solid #2dd4bf',
                  color: '#ccfbf1',
                  fontSize: '21px',
                }}
              >
                {step}
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      headers: {
        'Cache-Control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800',
      },
    }
  )
}
