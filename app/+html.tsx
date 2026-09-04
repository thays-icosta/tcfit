import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover, maximum-scale=1" />
        <title>TcFit — Consultoria Fitness &amp; Nutrição</title>
        <meta name="description" content="Acesse seus treinos personalizados, plano alimentar e acompanhe seus resultados em um só lugar." />

        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://tcfit.vercel.app/" />
        <meta property="og:title" content="TcFit — Consultoria Fitness & Nutrição" />
        <meta property="og:description" content="Acesse seus treinos personalizados, plano alimentar e acompanhe seus resultados em um só lugar." />
        <meta property="og:image" content="https://tcfit.vercel.app/og-image.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:locale" content="pt_BR" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="TcFit — Consultoria Fitness & Nutrição" />
        <meta name="twitter:description" content="Acesse seus treinos personalizados, plano alimentar e acompanhe seus resultados em um só lugar." />
        <meta name="twitter:image" content="https://tcfit.vercel.app/og-image.png" />

        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#f97316" />
        <link rel="icon" href="/favicon.png" />

        {/* iOS "Add to Home Screen" */}
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="TcFit" />

        {/* Android "Add to Home Screen" */}
        <meta name="mobile-web-app-capable" content="yes" />

        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: 'html, body { background-color: #0a0a0a; }' }} />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js');
                });
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                  window.location.reload();
                });
              }
            `,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
