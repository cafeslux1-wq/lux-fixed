import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { auth } from '../services/api';
import { useAppStore } from './useStore';

const SOCKET_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api/v1', '')
  : (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:4000');

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const { addKDSOrder, updateOrderStatus, addStockAlert, updateDashboard } = useAppStore();

  useEffect(() => {
    const token = auth.getToken(); if (!token) return;
    const socket = io(SOCKET_URL, { auth: { token }, transports: ['websocket'], reconnectionAttempts: 5, reconnectionDelay: 2000 });
    socketRef.current = socket;
    socket.on('connect',       () => console.log('[Socket] Connected'));
    socket.on('order:new',     (data: unknown) => addKDSOrder(data));
    socket.on('order:created', (data: unknown) => updateDashboard({ newOrder: data }));
    socket.on('order:status',  (data: { orderId: string; status: string }) => updateOrderStatus(data.orderId, data.status));
    socket.on('order:voided',  (data: { orderId: string }) => updateOrderStatus(data.orderId, 'cancelled'));
    socket.on('stock:low',     (data: { items: Array<{ name: string; level: string }> }) => data.items.forEach(item => addStockAlert(item)));
    socket.on('stock:critical',(data: { items: string }) => addStockAlert({ name: data.items, level: 'critical' }));
    socket.on('disconnect',    (reason: string) => console.log('[Socket] Disconnected:', reason));
    return () => { socket.disconnect(); socketRef.current = null; };
  }, [addKDSOrder, updateOrderStatus, addStockAlert, updateDashboard]);

  const emit = useCallback((event: string, data?: unknown) => { socketRef.current?.emit(event, data); }, []);
  return { emit, isConnected: !!socketRef.current?.connected };
}
