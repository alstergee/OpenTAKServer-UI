import axios from 'axios';

const instance = axios.create({
  withCredentials: true,
  withXSRFToken: true,
  maxRedirects: 0,
  headers: {
    Accept: 'application/json',
    'Content-Type': 'application/json',
  },
});

// Auth-expiry guard.
//
// Strict 401-only detection (no content-sniffing — that produced false
// positives that blacked out pages). When the server signals "this user is
// no longer authenticated", we:
//   1. clear the localStorage `loggedIn` flag so PrivateRoute bounces on
//      the next render and the navbar drops its "logged in" state, and
//   2. dispatch a custom 'mc-auth-expired' event so DefaultLayout (which
//      lives inside the React Router context and has access to useNavigate)
//      can do a real SPA navigation to /login. Avoids the hard-reload
//      window.location.href racing with React Router's own routing — that
//      race was producing the empty/black page the user saw.

let bouncing = false; // single-shot guard against multiple parallel 401s

function handleAuthFailure() {
  if (bouncing) return;
  bouncing = true;

  const path = window.location.pathname || '';
  if (
    path.startsWith('/login') ||
    path.startsWith('/register') ||
    path.startsWith('/password') ||
    path.startsWith('/recover')
  ) {
    bouncing = false;
    return;
  }
  try { localStorage.removeItem('loggedIn'); } catch { /* ignore */ }
  try {
    window.dispatchEvent(new CustomEvent('mc-auth-expired', {
      detail: { from: path + (window.location.search || '') + (window.location.hash || '') },
    }));
  } catch { /* ignore — older browsers */ }
  // Belt-and-suspenders: if no listener handled the event within 250ms
  // (e.g. the user is on a page that hasn't mounted DefaultLayout yet),
  // fall back to a clean replace() so we still land on /login.
  setTimeout(() => {
    if (window.location.pathname.startsWith('/login')) return;
    window.location.replace('/login');
  }, 250);
}

function attachInterceptors(client: typeof axios | ReturnType<typeof axios.create>) {
  client.interceptors.response.use(
    (response) => response,
    (error) => {
      const status = error?.response?.status;
      if (status === 401) {
        handleAuthFailure();
      }
      return Promise.reject(error);
    }
  );
}

attachInterceptors(instance);
attachInterceptors(axios);

export default instance;
