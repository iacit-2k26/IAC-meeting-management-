"use client";

export default function TruckLoader({ text = "Loading…", size = 0.50 }) {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center z-[100] animate-in fade-in duration-700">
      <style>{` 
      
        @keyframes iacBounce {
          0%, 100% { 
            transform: translateY(0px); 
            animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
          }
          50% { 
            transform: translateY(-55px); 
            animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
          }
        }
        @keyframes iacSquash {
          0%, 5%, 95%, 100% { 
            transform: scaleX(1.15) scaleY(0.8); 
          }
          15%, 85% { 
            transform: scaleX(1) scaleY(1); 
          } 
          50% { 
            transform: scaleX(0.98) scaleY(1.02); 
          }
        }
        @keyframes iacDot {
          0%,80%,100%{transform:scale(0.55);opacity:0.25}
          40%{transform:scale(1);opacity:1}
        }
        .iac-p1{animation:iacFloat 1.9s ease-in-out infinite 0s}
        .iac-p2{animation:iacFloat 1.9s ease-in-out infinite 0.22s}
        .iac-p3{animation:iacFloat 1.9s ease-in-out infinite 0.44s}
        .iac-ball{animation:iacBounce 1.1s ease-in-out infinite 0s}
        .iac-ball-inner{animation:iacSquash 1.1s ease-in-out infinite 0s;transform-origin:center bottom}
        .iac-d1{animation:iacDot 1.4s ease-in-out infinite 0s}
        .iac-d2{animation:iacDot 1.4s ease-in-out infinite 0.2s}
        .iac-d3{animation:iacDot 1.4s ease-in-out infinite 0.4s}
      `}</style>

      <div style={{ transform: `scale(${size})`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", gap: "5px", alignItems: "flex-end", height: "160px" }}>
          {/* Blue block with center-top notch */}
          <div className="iac-p1" style={{ position: "relative", width: "92px", height: "122px", flexShrink: 0 }}>
            <svg width="92" height="92" viewBox="0 0 92 92" style={{ position: "absolute", bottom: 0, left: 0 }}>
              <defs>
                <mask id="iac-bm3">
                  <rect x="0" y="0" width="92" height="92" rx="9" fill="white"/>
                  <circle cx="46" cy="0" r="28" fill="black"/>
                </mask>
              </defs>
              <rect x="0" y="0" width="92" height="92" rx="9" fill="#1E2A78" mask="url(#iac-bm3)"/>
            </svg>

            <div className="iac-ball" style={{ position: "absolute", left: "27%", bottom: "66px", transform: "translateX(-50%)", zIndex: 2 }}>
              <div className="iac-ball-inner">
                <svg width="52" height="52" viewBox="0 0 52 52">
                  <circle cx="22" cy="22" r="22" fill="#00C5DC"/>
                </svg>
              </div>
            </div>
          </div>

          {/* Red block: arch cutout at bottom */}
          <div className="iac-p2">
            <svg width="92" height="92" viewBox="0 0 92 92">
              <defs>
                <mask id="iac-rm3">
                  <rect x="0" y="0" width="92" height="92" rx="6" fill="white"/>
                  <circle cx="46" cy="92" r="30" fill="black"/>
                </mask>
              </defs>
              <rect x="0" y="0" width="92" height="92" rx="6" fill="#E5243B" mask="url(#iac-rm3)"/>
            </svg>
          </div>

          {/* Yellow block: C-bracket shape */}
          <div className="iac-p3">
            <svg width="92" height="92" viewBox="0 0 92 92">
              <defs>
                <mask id="iac-ym3">
                  <rect x="0" y="0" width="92" height="92" rx="9" fill="white"/>
                  <circle cx="92" cy="46" r="38" fill="black"/>
                </mask>
              </defs>
              <rect x="0" y="0" width="92" height="92" rx="9" fill="#F5C518" mask="url(#iac-ym3)"/>
            </svg>
          </div>
        </div>

        {/* <p style={{ marginTop: "34px", fontSize: "12px", fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase", color: "#94a3b8", opacity: 0.6, marginBottom: 0 }}>
          {text}
        </p>

        <div style={{ display: "flex", gap: "6px", marginTop: "13px", alignItems: "center" }}>
          <div className="iac-d1" style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#4F4BCC" }}></div>
          <div className="iac-d2" style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#4F4BCC" }}></div>
          <div className="iac-d3" style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#4F4BCC" }}></div>
        </div> */}
      </div>
    </div>
  );
}

