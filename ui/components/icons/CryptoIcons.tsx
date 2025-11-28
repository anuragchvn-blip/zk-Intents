import React from 'react';

export const EthIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="16" fill="#627EEA"/>
    <path d="M16 4L10.5 13.5L16 28L21.5 13.5L16 4Z" fill="white" fillOpacity="0.602"/>
    <path d="M16 4L10.5 13.5L16 16.5L21.5 13.5L16 4Z" fill="white"/>
    <path d="M16 22L10.5 14.5L16 28L21.5 14.5L16 22Z" fill="white"/>
    <path d="M16 20.5L21.5 13.5L16 16.5L10.5 13.5L16 20.5Z" fill="#C0CBF6"/>
  </svg>
);

export const UsdcIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="16" fill="#2775CA"/>
    <path d="M12.75 18.5C12.75 19.8807 13.8693 21 15.25 21H17.25C18.6307 21 19.75 19.8807 19.75 18.5V18C19.75 16.6193 18.6307 15.5 17.25 15.5H14.75C13.3693 15.5 12.25 14.3807 12.25 13V12.5C12.25 11.1193 13.3693 10 14.75 10H16.75C18.1307 10 19.25 11.1193 19.25 12.5" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
    <path d="M16 8.5V10" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
    <path d="M16 21V22.5" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
  </svg>
);

export const MaticIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="16" fill="#8247E5"/>
    <path d="M22.5 11L16 14.75L9.5 11L16 7.25L22.5 11Z" fill="white"/>
    <path d="M9.5 11V18.5L16 22.25V14.75L9.5 11Z" fill="white" fillOpacity="0.6"/>
    <path d="M22.5 11V18.5L16 22.25V14.75L22.5 11Z" fill="white" fillOpacity="0.8"/>
  </svg>
);

export const OpIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="16" fill="#FF0420"/>
    <path d="M22 10H10V22H22V10Z" fill="white"/>
    <path d="M14 14H18V18H14V14Z" fill="#FF0420"/>
  </svg>
);

export const ArbIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="16" fill="#2D374B"/>
    <path d="M16 8L8 24H24L16 8Z" fill="#28A0F0"/>
    <path d="M16 13L11.5 22H20.5L16 13Z" fill="white"/>
  </svg>
);

export const BaseIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="16" fill="#0052FF"/>
    <circle cx="16" cy="16" r="10" stroke="white" strokeWidth="4"/>
  </svg>
);

export const ZkSyncIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="16" cy="16" r="16" fill="#1E1E1E"/>
    <path d="M10 10H22L10 22H22" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const TokenIcon = ({ symbol, className }: { symbol: string; className?: string }) => {
  switch (symbol) {
    case 'ETH': return <EthIcon className={className} />;
    case 'WETH': return <EthIcon className={className} />;
    case 'USDC': return <UsdcIcon className={className} />;
    case 'USDT': return <UsdcIcon className={className} />; // Reusing USDC for now or generic
    case 'DAI': return <UsdcIcon className={className} />; // Reusing
    case 'MATIC': return <MaticIcon className={className} />;
    case 'OP': return <OpIcon className={className} />;
    case 'ARB': return <ArbIcon className={className} />;
    default: return <div className={`bg-gray-500 rounded-full ${className}`} />;
  }
};
