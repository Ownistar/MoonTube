import React, { useEffect, useRef } from 'react';

interface AdBannerProps {
  className?: string;
}

const AdBanner: React.FC<AdBannerProps> = ({ className }) => {
  const adRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (adRef.current) {
      // Clear previous content
      adRef.current.innerHTML = '';

      try {
        const configScript = document.createElement('script');
        configScript.type = 'text/javascript';
        configScript.innerHTML = `
          if (typeof atOptions === 'undefined') {
            var atOptions = {
              'key' : 'f02bb2f4cd09531450a35f6e89f8b68d',
              'format' : 'iframe',
              'height' : 60,
              'width' : 468,
              'params' : {}
            };
          }
        `;

        const invokeScript = document.createElement('script');
        invokeScript.type = 'text/javascript';
        invokeScript.src = 'https://accedelid.com/f02bb2f4cd09531450a35f6e89f8b68d/invoke.js';
        invokeScript.async = true;
        
        // Add error handling to script loading
        invokeScript.onerror = () => {
          console.warn('Ad script failed to load. This is likely due to an ad blocker.');
          if (adRef.current) adRef.current.innerHTML = '<div class="text-[8px] text-neutral-700">SIGNAL INTERRUPTED</div>';
        };

        adRef.current.appendChild(configScript);
        adRef.current.appendChild(invokeScript);
      } catch (err) {
        console.warn('Ad setup error:', err);
      }
    }
  }, []);

  return (
    <div className={`relative flex items-center justify-center overflow-visible ${className}`}>
      <div 
        ref={adRef} 
        style={{ width: '468px', height: '60px' }} 
        className="flex items-center justify-center overflow-hidden bg-neutral-900/10 rounded" 
      />
    </div>
  );
};

export default AdBanner;
