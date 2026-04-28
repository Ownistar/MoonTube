import React, { useEffect, useRef } from 'react';

interface AdUnitProps {
  type: 'banner' | 'sidebar' | 'native';
  className?: string;
  keyId?: string;
  width?: number;
  height?: number;
}

export default function AdUnit({ type, className, keyId = 'f02bb2f4cd09531450a35f6e89f8b68d', width = 468, height = 60 }: AdUnitProps) {
  const adRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!adRef.current) return;

    // Clear previous content
    adRef.current.innerHTML = '';
    
    // Create a wrapper div for the adsterra script
    // This allows the ad to be contained properly
    const adContainer = document.createElement('div');
    adContainer.className = 'ad-container flex items-center justify-center w-full h-full';
    
    const scriptOptions = document.createElement('script');
    scriptOptions.type = 'text/javascript';
    // Use the specific options provided by user
    scriptOptions.innerHTML = `
      atOptions = {
        'key' : '${keyId}',
        'format' : 'iframe',
        'height' : ${height},
        'width' : ${width},
        'params' : {}
      };
    `;
    
    const scriptInvoke = document.createElement('script');
    scriptInvoke.type = 'text/javascript';
    scriptInvoke.src = `https://accedelid.com/${keyId}/invoke.js`;
    scriptInvoke.onerror = () => {
      console.warn('Ad script failed to load');
    };

    adRef.current.appendChild(adContainer);
    adContainer.appendChild(scriptOptions);
    adContainer.appendChild(scriptInvoke);

    return () => {
      if (adRef.current) {
        adRef.current.innerHTML = '';
      }
    };
  }, [keyId, width, height]);

  return (
    <div className={`ad-wrapper overflow-hidden bg-neutral-900/20 border border-white/5 rounded-xl flex flex-col items-center justify-center p-2 ${className}`}>
      <div 
        ref={adRef}
        className="relative min-w-[468px] min-h-[60px]"
      />
      <span className="mt-1 text-[8px] uppercase tracking-widest text-white/10 font-bold">Sponsored Signal</span>
    </div>
  );
}
