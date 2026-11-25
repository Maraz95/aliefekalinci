/* KARANLIKTAN AYDINLIĞA — tünelden sonra "ışıklar yanar".
   Hakkımda bölümü ekranın alt çeyreğine girince oda ışığı floresan gibi titreyerek açılır;
   yukarı, tünele geri dönülünce söner. Lenis ile de çalışır (IntersectionObserver). */
(() => {
  const root = document.documentElement;
  const trigger = document.getElementById('about');
  if (!trigger) return;

  let on = false;
  const setLights = (state) => {
    if (state === on) return;
    on = state;
    if (on) {
      root.classList.add('lights-on', 'lights-flicker');
      setTimeout(() => root.classList.remove('lights-flicker'), 800);
    } else {
      root.classList.remove('lights-on', 'lights-flicker');
    }
  };

  // Hakkımda'nın üst kenarı ekranın %75'ine geldiğinde ışık yanar
  new IntersectionObserver(([e]) => {
    const passed = e.boundingClientRect.top < window.innerHeight * 0.75;
    setLights(passed);
  }, { rootMargin: '0px 0px -25% 0px', threshold: [0, 1] }).observe(trigger);
})();
