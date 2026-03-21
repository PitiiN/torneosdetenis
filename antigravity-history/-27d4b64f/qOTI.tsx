'use client'

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

interface ChartDataPoint {
    name: string
    reservas: number
    confirmadas: number
}

interface BookingsChartProps {
    data: ChartDataPoint[]
    title?: string
}

export function BookingsChart({ data, title = 'Reservas por Día' }: BookingsChartProps) {
    return (
        <div className="w-full">
            {title && (
                <h3 className="text-sm font-medium text-muted-foreground mb-4">{title}</h3>
            )}
            <ResponsiveContainer width="100%" height={300}>
                <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                        dataKey="name"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                    />
                    <YAxis
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals={false}
                    />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            color: 'hsl(var(--foreground))',
                        }}
                    />
                    <Bar
                        dataKey="reservas"
                        name="Total Reservas"
                        fill="hsl(var(--primary))"
                        radius={[4, 4, 0, 0]}
                    />
                    <Bar
                        dataKey="confirmadas"
                        name="Confirmadas"
                        fill="hsl(142 76% 36%)"
                        radius={[4, 4, 0, 0]}
                    />
                </BarChart>
            </ResponsiveContainer>
        </div>
    )
}
