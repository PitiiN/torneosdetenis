import Link from 'next/link'
import { CalendarDays, CreditCard, CheckCircle, ArrowRight, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function HomePage() {
    return (
        <main className="min-h-screen flex flex-col items-center justify-center p-6 md:p-8 relative overflow-hidden">
            {/* Background decorative elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-[radial-gradient(ellipse_at_center,_rgb(var(--primary)/0.15)_0%,_transparent_70%)]" />
                <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-[radial-gradient(ellipse_at_center,_rgb(var(--accent)/0.1)_0%,_transparent_70%)]" />
            </div>

            <div className="text-center space-y-10 max-w-3xl relative z-10 animate-fade-in">
                {/* Logo/Header */}
                <div className="space-y-6">
                    <div className="w-24 h-24 mx-auto rounded-2xl gradient-primary flex items-center justify-center shadow-2xl shadow-primary/30 animate-pulse-glow">
                        <CalendarDays className="w-12 h-12 text-white" />
                    </div>
                    <div className="space-y-3">
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold">
                            <span className="gradient-text">Arriendo</span>{' '}
                            <span className="text-foreground">Canchas</span>
                        </h1>
                        <p className="text-muted-foreground text-lg md:text-xl max-w-xl mx-auto leading-relaxed">
                            Sistema de reservas para canchas deportivas.
                            <span className="text-foreground font-medium"> Fácil, rápido y seguro.</span>
                        </p>
                    </div>
                </div>

                {/* Features */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
                    <div className="p-6 rounded-2xl glass-card group hover:scale-[1.02] transition-all duration-300">
                        <div className="w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center mb-5 mx-auto group-hover:bg-primary/30 transition-colors">
                            <CalendarDays className="w-7 h-7 text-primary" />
                        </div>
                        <h3 className="font-semibold mb-2 text-lg">Disponibilidad en Tiempo Real</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Consulta los horarios disponibles al instante
                        </p>
                    </div>

                    <div className="p-6 rounded-2xl glass-card group hover:scale-[1.02] transition-all duration-300">
                        <div className="w-14 h-14 rounded-xl bg-accent/20 flex items-center justify-center mb-5 mx-auto group-hover:bg-accent/30 transition-colors">
                            <CreditCard className="w-7 h-7 text-accent" />
                        </div>
                        <h3 className="font-semibold mb-2 text-lg">Pago por Transferencia</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Al momento de realizar tu pago se confirma tu reserva
                        </p>
                    </div>

                    <div className="p-6 rounded-2xl glass-card group hover:scale-[1.02] transition-all duration-300">
                        <div className="w-14 h-14 rounded-xl bg-success/20 flex items-center justify-center mb-5 mx-auto group-hover:bg-success/30 transition-colors">
                            <CheckCircle className="w-7 h-7 text-success" />
                        </div>
                        <h3 className="font-semibold mb-2 text-lg">Confirmación Rápida</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            Validación de pagos en tiempo récord
                        </p>
                    </div>
                </div>

                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                    <Link href="/auth/login">
                        <Button size="xl" variant="glow" className="w-full sm:w-auto group">
                            Iniciar Sesión
                            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                        </Button>
                    </Link>
                    <Link href="/auth/register">
                        <Button size="xl" variant="outline" className="w-full sm:w-auto">
                            Crear Cuenta
                            <Sparkles className="w-5 h-5" />
                        </Button>
                    </Link>
                </div>


            </div>
        </main>
    )
}
