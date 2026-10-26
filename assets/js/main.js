// RC Ehrenfeld 1976 e.V. – mobiles Menü
(function () {
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('hauptmenue');
  if (!toggle || !nav) return;

  function schliessen() {
    nav.classList.remove('offen');
    toggle.setAttribute('aria-expanded', 'false');
  }

  toggle.addEventListener('click', function () {
    var offen = nav.classList.toggle('offen');
    toggle.setAttribute('aria-expanded', offen ? 'true' : 'false');
  });

  nav.addEventListener('click', function (e) {
    if (e.target.closest('a')) schliessen();
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') schliessen();
  });

  window.addEventListener('resize', function () {
    if (window.innerWidth > 760) schliessen();
  });
})();
