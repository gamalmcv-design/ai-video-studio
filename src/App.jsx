import React, { useEffect, useState } from 'react';
import DashboardImagePage from './pages/DashboardImage';
import DashboardScriptPage from './pages/DashboardScript';
import DashboardVideoPage from './pages/DashboardVideo';

const toolCards = [
  {
    title: 'توليد الفيديو',
    icon: '🎬',
    route: '/dashboard/video',
    accent: 'gold',
    label: 'Video',
  },
  {
    title: 'توليد الصور',
    icon: '🖼️',
    route: '/dashboard/image',
    accent: 'cyan',
    label: 'Image',
  },
  {
    title: 'كتابة السكريبتات',
    icon: '✍️',
    route: '/dashboard/script',
    accent: 'gold',
    label: 'Script',
  },
];

function App() {
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handleRouteChange = () => setCurrentPath(window.location.pathname);
    window.addEventListener('popstate', handleRouteChange);
    return () => window.removeEventListener('popstate', handleRouteChange);
  }, []);

  const navigateTo = (path) => {
    window.history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  if (currentPath === '/dashboard/video' || currentPath.startsWith('/dashboard/video')) {
    return <DashboardVideoPage />;
  }

  if (currentPath === '/dashboard/image' || currentPath.startsWith('/dashboard/image')) {
    return <DashboardImagePage />;
  }

  if (currentPath === '/dashboard/script' || currentPath.startsWith('/dashboard/script')) {
    return <DashboardScriptPage />;
  }

  return (
    <div className="page-shell">
      <div className="background-glow glow-gold" />
      <div className="background-glow glow-cyan" />

      <header className="topbar container">
        <div className="brand-wrap" aria-label="شعار منصة الشرقاوي">
          <div className="brand-mark">
            <span>م</span>
          </div>
          <div className="brand-copy">
            <small>منصة</small>
            <strong>الشرقاوي</strong>
          </div>
        </div>
        <button type="button" className="ghost-button" aria-label="القائمة">
          القائمة
        </button>
      </header>

      <main className="container main-stack">
        <section className="hero card">
          <div className="hero-copy">
            <span className="eyebrow">إبداع يليق بالعلامة الرائدة</span>
            <h1>منصة الشرقاوي</h1>
            <p>
              أدوات عربية فاخرة لتوليد الفيديوهات، الصور، والسكريبتات داخل واجهة مناسبة
              للموبايل، مع تجربة احترافية ومتماسكة.
            </p>
          </div>

          <div className="hero-visual" aria-hidden="true">
            <div className="visual-orb" />
            <div className="floating-panel panel-top">
              <span>Studio</span>
              <strong>ابدأ الآن</strong>
            </div>
            <div className="floating-panel panel-bottom">
              <span>Luxury</span>
              <strong>Damage free</strong>
            </div>
          </div>
        </section>

        <section className="features-wrap tool-selection-wrap">
          {toolCards.map((item) => (
            <button
              key={item.route}
              type="button"
              className={`feature-card tool-card ${item.accent}`}
              onClick={() => navigateTo(item.route)}
            >
              <div className="feature-head">
                <span className="feature-icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="feature-tag">{item.label}</span>
              </div>
              <h2>{item.title}</h2>
            </button>
          ))}
        </section>
      </main>
    </div>
  );
}

export default App;
