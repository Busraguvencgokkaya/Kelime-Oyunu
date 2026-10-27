import { useEffect, useState, lazy, Suspense } from 'react';
import { api, isDemo } from './api/index.js';
import { useRoute, go } from './lib/util.js';
import { Spinner } from './components/ui.jsx';
import { Login, NewPassword } from './pages/Auth.jsx';
import Shell from './pages/Shell.jsx';
import Home from './pages/Home.jsx';
import BookPage from './pages/BookPage.jsx';
import SetsPage from './pages/SetsPage.jsx';
import SetEditor from './pages/SetEditor.jsx';
import Assignments from './pages/Assignments.jsx';
import NewAssignment from './pages/NewAssignment.jsx';
import Play from './pages/Play.jsx';
import ClassMode from './pages/ClassMode.jsx';

const BulkImport = lazy(() => import('./pages/BulkImport.jsx'));
const Report = lazy(() => import('./pages/Report.jsx'));

export default function App() {
  const route = useRoute();
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    let alive = true;
    api.getUser().then((u) => alive && setUser(u));
    const off = api.onAuth((u, event) => {
      setUser(u);
      if (event === 'PASSWORD_RECOVERY') go('/sifre');
    });
    return () => { alive = false; off(); };
  }, []);

  const [p0, p1] = route.parts;

  // Öğrenci bağlantısı: giriş gerekmez
  if (p0 === 'o') return <Play key={p1} slug={p1} />;

  if (user === undefined) return <div className="page-center"><Spinner /></div>;
  if (p0 === 'sifre' && user) return <NewPassword />;
  if (!user) return <Login />;

  let page;
  if (!p0) page = <Home user={user} />;
  else if (p0 === 'kitap') page = <BookPage id={p1} user={user} />;
  else if (p0 === 'setler') page = <SetsPage user={user} />;
  else if (p0 === 'set') page = <SetEditor key={p1 + route.query.toString()} id={p1 === 'yeni' ? null : p1} query={route.query} user={user} />;
  else if (p0 === 'yukle') page = <BulkImport user={user} />;
  else if (p0 === 'odevler') page = <Assignments />;
  else if (p0 === 'odev' && p1 === 'yeni') page = <NewAssignment query={route.query} user={user} />;
  else if (p0 === 'odev') page = <Report id={p1} />;
  else if (p0 === 'sinif') page = <ClassMode key={route.query.toString()} query={route.query} user={user} />;
  else page = <Home user={user} />;

  return (
    <Shell user={user} active={p0 || 'kitaplar'} demo={isDemo}>
      <Suspense fallback={<Spinner />}>{page}</Suspense>
    </Shell>
  );
}
