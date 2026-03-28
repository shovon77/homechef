import { Redirect } from 'expo-router';

/** Legacy `/auth/signup` → `/signup` */
export default function AuthSignupRedirect() {
  return <Redirect href="/signup" />;
}
