import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import CapacitorInit from '@/components/CapacitorInit'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
    title: 'Arriendo Canchas - Reserva tu cancha',
    description: 'Sistema de arriendo de canchas deportivas',
    viewport: 'width=device-width, initial-scale=1, viewport-fit=cover',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="es" className="dark">
            <body className={inter.className}>
                <CapacitorInit />
                {children}
            </body>
        </html>
    )
}
