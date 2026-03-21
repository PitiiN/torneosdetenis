import Link from 'next/link'

export default function HomePage() {
    return (
        <main className="min-h-screen flex flex-col items-center justify-center p-8">
            <div className="text-center space-y-8 max-w-2xl">
                {/* Logo/Header */}
                <div className="space-y-4">
                    <div className="w-20 h-20 mx-auto rounded-2xl gradient-primary flex items-center justify-center">
                        <svg
                            className="w-10 h-10 text-white"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                            />
                        </svg>
                    </div>
                    <h1 className="text-4xl font-bold gradient-text">
                        Arriendo Canchas
                    </h1>
                    <p className="text-muted-foreground text-lg">
                        Sistema de reservas para canchas deportivas. Fácil, rápido y seguro.
                    </p>
                </div>

                {/* Features */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-6 rounded-xl glass">
                        <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center mb-4 mx-auto">
                            <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <h3 className="font-semibold mb-2">Disponibilidad en Tiempo Real</h3>
                        <p className="text-sm text-muted-foreground">Consulta los horarios disponibles al instante</p>
                    </div>

                    <div className="p-6 rounded-xl glass">
                        <div className="w-12 h-12 rounded-lg bg-accent/20 flex items-center justify-center mb-4 mx-auto">
                            <svg className="w-6 h-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h3 className="font-semibold mb-2">Pago por Transferencia</h3>
                        <p className="text-sm text-muted-foreground">Sube tu comprobante y confirma tu reserva</p>
                    </div>

                    <div className="p-6 rounded-xl glass">
                        <div className="w-12 h-12 rounded-lg bg-success/20 flex items-center justify-center mb-4 mx-auto">
                            <svg className="w-6 h-6 text-success" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h3 className="font-semibold mb-2">Confirmación Rápida</h3>
                        <p className="text-sm text-muted-foreground">Validación de pagos en tiempo récord</p>
                    </div>
                </div>

                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Link
                        href="/auth/login"
                        className="px-8 py-3 rounded-lg gradient-primary text-white font-semibold hover:opacity-90 transition-opacity"
                    >
                        Iniciar Sesión
                    </Link>
                    <Link
                        href="/auth/register"
                        className="px-8 py-3 rounded-lg border border-border text-foreground font-semibold hover:bg-secondary transition-colors"
                    >
                        Crear Cuenta
                    </Link>
                </div>

                {/* Footer note */}
                <p className="text-sm text-muted-foreground">
                    ¿Eres administrador?{' '}
                    <Link href="/auth/login" className="text-primary hover:underline">
                        Accede aquí
                    </Link>
                </p>
            </div>
        </main>
    )
}
