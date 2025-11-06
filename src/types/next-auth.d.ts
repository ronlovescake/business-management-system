import 'next-auth';

declare module 'next-auth' {
  interface User {
    id: string;
    email: string;
    name?: string | null;
    role: string;
    photoUrl?: string | null;
  }

  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: string;
      photoUrl?: string | null;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: string;
    email: string;
    photoUrl?: string | null;
  }
}
