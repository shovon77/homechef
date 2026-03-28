import { Redirect } from 'expo-router';

/** Legacy `/auth/login` → `/login` */
export default function AuthLoginRedirect() {
  return <Redirect href="/login" />;
}
