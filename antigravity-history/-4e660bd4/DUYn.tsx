import DashboardLayout from '@/components/dashboard/DashboardLayout'

export default function DashboardPageLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return <DashboardLayout>{children}</DashboardLayout>
}
