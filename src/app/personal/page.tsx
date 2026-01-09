import { redirect } from 'next/navigation';

export default function PersonalRootRedirect() {
  return redirect('/personal/dashboard');
}
