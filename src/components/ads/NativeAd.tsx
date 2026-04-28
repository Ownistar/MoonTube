import React, { useEffect, useRef } from 'react';

const AD_KEY = '0e1c055ee60481c4b205cea892c5e7cc';

export default function NativeAd() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create unique container to house the ad
    const containerId = `container-${AD_KEY}`;
    
    // Clean up existing content
    containerRef.current.innerHTML = '';
    
    const adTarget = document.createElement('div');
    adTarget.id = containerId;
    containerRef.current.appendChild(adTarget);

    const script = document.createElement('script');
    script.async = true;
    script.setAttribute('data-cfasync', 'false');
    script.src = `https://accedelid.com/${AD_KEY}/invoke.js`;
    script.onerror = () => {
      console.warn('Ad script failed to load');
    };
    
    containerRef.current.appendChild(script);

    return () => {
      // Avoid clearing if possible to prevent errors during script execution
      // but we need to stop it if it's still running
      if (containerRef.current) {
        // Just empty it out
        containerRef.current.innerHTML = '';
      }
    };
  }, [AD_KEY]); // Stable dependency

  return (
    <div className="w-full my-6 bg-neutral-900/10 border border-white/5 rounded-3xl overflow-hidden relative">
      <div className="absolute top-2 right-4 z-10">
        <span className="text-[6px] font-black uppercase text-white/20 tracking-[0.3em]">Signal Feed</span>
      </div>
      <div 
        ref={containerRef} 
        className="min-h-[80px] w-full flex items-center justify-center p-2"
      />
    </div>
  );
}
