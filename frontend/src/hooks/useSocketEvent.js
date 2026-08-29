import { useEffect } from 'react';
import socket from '../api/socket';

export function useSocketEvent(event, handler) {
  useEffect(() => {
    socket.on(event, handler);
    return () => {
      socket.off(event, handler);
    };
  }, [event, handler]);
}