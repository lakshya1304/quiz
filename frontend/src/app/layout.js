import './globals.css'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata = {
  title: 'Techive Quiz',
  description: "Engineer's Day — Techive Quiz organized by IoT & Robotics Club",
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="grid-bg"></div>
        <div className="scan-line"></div>
        {children}
      </body>
    </html>
  )
}
