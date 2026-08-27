import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chords",
  description: "A quiet songbook for chords, with shapes for guitar, piano, ukulele and banjo.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf8" },
    { media: "(prefers-color-scheme: dark)", color: "#14140f" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              `try{for(var i=localStorage.length-1;i>=0;i--){var k=localStorage.key(i);` +
              `if(k&&k.indexOf("muzik:")===0){var n="chords:"+k.slice(6);` +
              `if(localStorage.getItem(n)===null)localStorage.setItem(n,localStorage.getItem(k));` +
              `localStorage.removeItem(k);}}` +
              `var t=localStorage.getItem("chords:theme");if(t)document.documentElement.dataset.theme=t}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
