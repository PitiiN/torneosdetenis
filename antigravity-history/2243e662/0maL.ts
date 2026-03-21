import { create } from 'zustand';

export type Announcement = {
    id: string;
    title: string;
    body: string;
    priority: 'normal' | 'important';
    date: string;
};

export type Solicitud = {
    id: string;
    title: string;
    description: string;
    user: string;
    date: string;
    status: 'Abierta' | 'En proceso' | 'Resuelta' | 'Rechazada';
    hasImage: boolean;
    imageUri?: string;
};

export type Document = {
    id: string;
    title: string;
    type: string;
    date: string;
    emoji: string;
};

export type Member = {
    id: string;
    name: string;
    email: string;
    role: string;
    active: boolean;
};

export type FinanceEntry = {
    id: string;
    type: 'income' | 'expense';
    category: string;
    description: string;
    amount: number;
    date: string;
};

type AppStore = {
    announcements: Announcement[];
    solicitudes: Solicitud[];
    documents: Document[];
    members: Member[];
    finances: FinanceEntry[];
    addAnnouncement: (a: Omit<Announcement, 'id' | 'date'>) => void;
    addSolicitud: (s: Omit<Solicitud, 'id' | 'date' | 'status'>) => void;
    updateSolicitudStatus: (id: string, status: Solicitud['status']) => void;
    addDocument: (d: Omit<Document, 'id' | 'date'>) => void;
    removeDocument: (id: string) => void;
    addFinanceEntry: (f: Omit<FinanceEntry, 'id'>) => void;
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

    addAnnouncement: (a) => set((state) => ({
        announcements: [{ ...a, id: Date.now().toString(), date: now() }, ...state.announcements],
    })),

    addSolicitud: (s) => set((state) => ({
        solicitudes: [{ ...s, id: Date.now().toString(), date: now(), status: 'Abierta' }, ...state.solicitudes],
    })),

    updateSolicitudStatus: (id, status) => set((state) => ({
        solicitudes: state.solicitudes.map(s => s.id === id ? { ...s, status } : s),
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
}));
