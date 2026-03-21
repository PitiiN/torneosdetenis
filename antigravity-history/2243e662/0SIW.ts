import { create } from 'zustand';

export type Announcement = {
    id: string; title: string; body: string; priority: 'normal' | 'important'; date: string;
};

export type SolicitudReply = {
    id: string; message: string; from: 'admin' | 'user'; date: string;
};

export type Solicitud = {
    id: string; title: string; description: string; user: string; userEmail: string; date: string;
    status: 'Abierta' | 'En proceso' | 'Resuelta' | 'Rechazada';
    hasImage: boolean; imageUri?: string; replies: SolicitudReply[];
};

export type Document = {
    id: string; title: string; type: string; date: string; emoji: string; fileUri?: string;
};

export type Member = {
    id: string; name: string; email: string; role: string; active: boolean;
};

export type MemberDue = {
    id: string; memberId: string; memberName: string; month: number; year: number; amount: number;
    status: 'paid' | 'pending' | 'overdue'; paidDate?: string;
};

export type FinanceEntry = {
    id: string; type: 'income' | 'expense'; category: string; description: string; amount: number; date: string;
};

type AppStore = {
    announcements: Announcement[];
    solicitudes: Solicitud[];
    documents: Document[];
    members: Member[];
    finances: FinanceEntry[];
    memberDues: MemberDue[];

    addAnnouncement: (a: Omit<Announcement, 'id' | 'date'>) => void;
    updateAnnouncement: (id: string, updates: Partial<Announcement>) => void;
    removeAnnouncement: (id: string) => void;

    addSolicitud: (s: Omit<Solicitud, 'id' | 'date' | 'status' | 'replies'>) => void;
    updateSolicitudStatus: (id: string, status: Solicitud['status']) => void;
    addSolicitudReply: (solicitudId: string, message: string, from: 'admin' | 'user') => void;

    addDocument: (d: Omit<Document, 'id' | 'date'>) => void;
    removeDocument: (id: string) => void;

    addFinanceEntry: (f: Omit<FinanceEntry, 'id'>) => void;
    updateFinanceEntry: (id: string, updates: Partial<FinanceEntry>) => void;
    removeFinanceEntry: (id: string) => void;

    updateMemberDue: (id: string, status: MemberDue['status'], paidDate?: string) => void;
};

const now = () => new Date().toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });

export const useAppStore = create<AppStore>((set) => ({
    announcements: [
        { id: '1', title: 'Reunión mensual de vecinos', body: 'Los invitamos a la reunión mensual este sábado a las 10:00 hrs en la sede vecinal. Se tratarán temas de seguridad y mejoras al barrio.', priority: 'important', date: '28 Feb 2026' },
        { id: '2', title: 'Corte de agua programado', body: 'Se informa corte de agua el día lunes de 09:00 a 14:00 hrs por trabajos de mantenimiento en la red de agua potable.', priority: 'normal', date: '27 Feb 2026' },
        { id: '3', title: 'Nuevo horario de recolección', body: 'A partir de marzo, la recolección de basura será los días lunes, miércoles y viernes a partir de las 07:00 hrs.', priority: 'normal', date: '25 Feb 2026' },
    ],
    solicitudes: [],
    documents: [
        { id: '1', title: 'Acta Reunión Febrero 2026', type: 'Acta', date: '15 Feb 2026', emoji: '📋' },
        { id: '2', title: 'Reglamento Interno JJVV', type: 'Reglamento', date: '01 Ene 2026', emoji: '📖' },
        { id: '3', title: 'Balance Financiero 2025', type: 'Finanzas', date: '31 Dic 2025', emoji: '💰' },
    ],
    members: [
        { id: '1', name: 'Javier Aravena Espejo', email: 'javier.aravena25@gmail.com', role: 'Presidente', active: true },
    ],
    finances: [
        { id: '1', type: 'income', category: 'Cuotas', description: 'Cuotas Enero 2026', amount: 250000, date: '31 Ene 2026' },
        { id: '2', type: 'expense', category: 'Mantenimiento', description: 'Reparación luminarias', amount: 85000, date: '15 Feb 2026' },
        { id: '3', type: 'income', category: 'Cuotas', description: 'Cuotas Febrero 2026', amount: 200000, date: '28 Feb 2026' },
    ],
    memberDues: [
        { id: 'd1', memberId: '1', memberName: 'Javier Aravena Espejo', month: 1, year: 2026, amount: 5000, status: 'paid', paidDate: '15 Ene 2026' },
        { id: 'd2', memberId: '1', memberName: 'Javier Aravena Espejo', month: 2, year: 2026, amount: 5000, status: 'pending' },
        { id: 'd3', memberId: '1', memberName: 'Javier Aravena Espejo', month: 3, year: 2026, amount: 5000, status: 'pending' },
        { id: 'd4', memberId: '1', memberName: 'Javier Aravena Espejo', month: 10, year: 2025, amount: 5000, status: 'overdue' },
        { id: 'd5', memberId: '1', memberName: 'Javier Aravena Espejo', month: 11, year: 2025, amount: 5000, status: 'paid', paidDate: '10 Nov 2025' },
        { id: 'd6', memberId: '1', memberName: 'Javier Aravena Espejo', month: 12, year: 2025, amount: 5000, status: 'paid', paidDate: '12 Dic 2025' },
    ],

    addAnnouncement: (a) => set((state) => ({
        announcements: [{ ...a, id: Date.now().toString(), date: now() }, ...state.announcements],
    })),
    updateAnnouncement: (id, updates) => set((state) => ({
        announcements: state.announcements.map(a => a.id === id ? { ...a, ...updates } : a),
    })),
    removeAnnouncement: (id) => set((state) => ({
        announcements: state.announcements.filter(a => a.id !== id),
    })),

    addSolicitud: (s) => set((state) => ({
        solicitudes: [{ ...s, id: Date.now().toString(), date: now(), status: 'Abierta', replies: [] }, ...state.solicitudes],
    })),
    updateSolicitudStatus: (id, status) => set((state) => ({
        solicitudes: state.solicitudes.map(s => s.id === id ? { ...s, status } : s),
    })),
    addSolicitudReply: (solicitudId, message, from) => set((state) => ({
        solicitudes: state.solicitudes.map(s => s.id === solicitudId ? {
            ...s, replies: [...s.replies, { id: Date.now().toString(), message, from, date: now() }]
        } : s),
    })),

    addDocument: (d) => set((state) => ({
        documents: [{ ...d, id: Date.now().toString(), date: now() }, ...state.documents],
    })),
    removeDocument: (id) => set((state) => ({
        documents: state.documents.filter(d => d.id !== id),
    })),

    addFinanceEntry: (f) => set((state) => ({
        finances: [{ ...f, id: Date.now().toString() }, ...state.finances],
    })),
    updateFinanceEntry: (id, updates) => set((state) => ({
        finances: state.finances.map(f => f.id === id ? { ...f, ...updates } : f),
    })),
    removeFinanceEntry: (id) => set((state) => ({
        finances: state.finances.filter(f => f.id !== id),
    })),

    updateMemberDue: (id, status, paidDate) => set((state) => ({
        memberDues: state.memberDues.map(d => d.id === id ? { ...d, status, paidDate } : d),
    })),
}));
