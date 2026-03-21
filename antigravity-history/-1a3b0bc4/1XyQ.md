# Real-Time Synchronization for My Classes & Payments

This plan covers adding real-time updates and improved navigation synchronization to ensure the user's view of their classes and their monthly plan allowance is always accurate.

## Proposed Changes

### [My Classes]

#### [MODIFY] [my-classes.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(tabs)/my-classes.tsx)
- Added `useFocusEffect` to trigger `load()` whenever the screen is focused.
- Ensured all upcoming classes are visible in the list.

---

### [Payments]

#### [MODIFY] [payments.tsx](file:///c:/Users/Asus/OneDrive%20-%20CORPORACI%C3%93N%20XIX%20JUEGOS%20PANAMERICANOS%20SANTIAGO%202023/Escritorio/PitiN/Antigravity/EscuelaDeTenis/app/(tabs)/payments.tsx)
- Import `useFocusEffect` from `expo-router`.
- Add `useFocusEffect` to reload data when the screen is focused.
- Set up a real-time subscription for `payment_receipts`, `enrollments`, and `product_memberships` for the current student.
- This ensures the "Tu Plan Mensual" card (allowance) updates immediately when a payment is approved or a class is used.

## Verification Plan

### Manual Verification
1. **Payments Focus Refresh**: Open "Payments", note the allowance. Enroll in a class from "Inicio", go back to "Payments". Confirm the "Usadas" count increased immediately.
2. **Payments Real-Time**: While on the "Payments" screen, have an admin approve a payment receipt. Confirm the "Disponibles" count updates without leaving the screen.
3. **My Classes Focus Refresh**: Verify "My Classes" still updates correctly on focus.
