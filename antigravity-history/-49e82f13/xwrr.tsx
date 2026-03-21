'use client'

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts'

interface StatusData {
    name: string
    value: number
    color: string
}

interface StatusPieChartProps {
    data: StatusData[]
    title?: string
}

export function StatusPieChart({ data, title = 'Estado de Reservas' }: StatusPieChartProps) {
    return (
        <div className="w-full">
            {title && (
                <h3 className="text-sm font-medium text-muted-foreground mb-4">{title}</h3>
            )}
            <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                    >
                        {data.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                    </Pie>
                    <Tooltip
                        contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            color: 'hsl(var(--foreground))',
                        }}
                    />
                    <Legend
                        iconType="circle"
                        wrapperStyle={{
                            fontSize: '12px',
                        }}
                    />
                </PieChart>
            </ResponsiveContainer>
        </div>
    )
}
