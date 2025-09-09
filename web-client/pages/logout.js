import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useContext } from 'react';
import { AppContext } from '../contexts/AppContext';

const Logout = () => {
  const router = useRouter();
  const { logout } = useContext(AppContext);

  useEffect(() => {
    const performLogout = async () => {
      await logout();
      router.push('/');
    };
    performLogout();
  }, [logout, router]);

  return null;
};

export default Logout;