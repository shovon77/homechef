import { useAuth } from '../context/AuthContext';

export function useRole() {
  return useAuth();
}
