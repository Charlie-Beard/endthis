(() => {
  // EndThis application logic

  const app = document.getElementById('app');

  const init = () => {
    console.log('EndThis initialized');
  };

  // Initialize on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
